import { NotificationType, TicketStatus } from '../domain/enums';
import type { Ticket } from '../domain/models';
import { AppError, createAppError, ValidationError } from '../errors/app-error';
import { notificationRepository, ticketRepository, userRepository } from '../repositories';
import type { UnitOfWorkContext } from '../repositories/unit-of-work';

function mapProcedureError(error: unknown): never {
  const message = typeof error === 'object' && error !== null && 'sqlMessage' in error
    ? String(error.sqlMessage)
    : error instanceof Error
      ? error.message
      : '';
  const code = /(?:^|: )([A-Z_]+)$/.exec(message)?.[1];
  const messages: Record<string, { message: string; status: number }> = {
    TICKET_NOT_FOUND: { message: 'Chamado não encontrado.', status: 404 },
    NOT_TICKET_OWNER: { message: 'Você não pode cancelar este chamado.', status: 403 },
    NOT_ASSIGNED_TECHNICIAN: { message: 'Este chamado não está atribuído a você.', status: 403 },
    TICKET_INVALID_TRANSITION: { message: 'A situação atual não permite esta operação.', status: 400 },
    TICKET_ALREADY_ASSUMED: { message: 'Este chamado já foi assumido.', status: 409 },
    TICKET_ALREADY_RESOLVED: { message: 'Este chamado já foi concluído.', status: 409 },
  };
  if (code && messages[code]) {
    throw createAppError(code, messages[code].message, messages[code].status);
  }
  if (error instanceof AppError) throw error;
  throw error;
}

export async function createTicket(input: { clientId: number; sectorId: number | null; title: string; description: string }, context: UnitOfWorkContext = {}): Promise<Ticket> {
  return ticketRepository.create({
    clientId: input.clientId,
    technicianId: null,
    sectorId: input.sectorId,
    title: input.title,
    description: input.description,
    status: TicketStatus.OPEN,
    resolutionNote: null,
    assumedAt: null,
    resolvedAt: null,
    cancelledAt: null,
  }, context);
}

export async function listTicketsForClient(clientId: number): Promise<Ticket[]> {
  return ticketRepository.findByClient(clientId);
}

export async function countTicketsByClient(clientId: number): Promise<Record<string, number>> {
  const tickets = await listTicketsForClient(clientId);
  const counts = { OPEN: 0, IN_PROGRESS: 0, RESOLVED: 0, CANCELLED: 0 } as Record<string, number>;
  for (const ticket of tickets) counts[ticket.status] = (counts[ticket.status] ?? 0) + 1;
  return counts;
}

export async function listOpenTickets(): Promise<Ticket[]> {
  return ticketRepository.findOpen();
}

export async function getTicket(ticketId: number): Promise<Ticket | null> {
  return ticketRepository.findById(ticketId);
}

export async function updateTicket(ticketId: number, patch: Partial<Ticket>, context: UnitOfWorkContext = {}): Promise<Ticket | null> {
  return ticketRepository.update(ticketId, patch, context);
}

export async function assumeTicket(ticketId: number, technicianId: number, requestId?: string): Promise<Ticket> {
  const ticket = await ticketRepository.findById(ticketId);
  if (!ticket) throw new ValidationError('Chamado não encontrado.', { code: 'TICKET_NOT_FOUND' });
  if (ticket.status !== TicketStatus.OPEN) throw new ValidationError('Somente chamados abertos podem ser assumidos.', { code: 'INVALID_TICKET_STATE' });

  let ticketUpdated: Ticket | null;
  try {
    await ticketRepository.runLifecycleProcedure('sp_assume_ticket', [ticketId, technicianId], {
      actorId: technicianId,
      requestId,
    });
    ticketUpdated = await ticketRepository.findById(ticketId);
  } catch (error) {
    mapProcedureError(error);
  }

  if (ticketUpdated) {
    const client = await userRepository.findById(ticket.clientId);
    if (client) {
      await notificationRepository.create({
        userId: client.id,
        type: NotificationType.TICKET_ASSUMED,
        ticketId: ticketUpdated.id,
        actorId: technicianId,
        message: `Chamado assumido por ${techName(technicianId)}.`,
      }, { actorId: technicianId, requestId });
    }
  }

  return ticketUpdated as Ticket;
}

export async function returnTicket(ticketId: number, technicianId: number, requestId?: string): Promise<Ticket> {
  const ticket = await ticketRepository.findById(ticketId);
  if (!ticket) throw new ValidationError('Chamado não encontrado.', { code: 'TICKET_NOT_FOUND' });
  if (ticket.technicianId !== technicianId || ticket.status !== TicketStatus.IN_PROGRESS) {
    throw new ValidationError('Este chamado não pode ser devolvido neste estado.', { code: 'INVALID_TICKET_STATE' });
  }

  let updated: Ticket | null;
  try {
    await ticketRepository.runLifecycleProcedure('sp_return_ticket', [ticketId, technicianId], {
      actorId: technicianId,
      requestId,
    });
    updated = await ticketRepository.findById(ticketId);
  } catch (error) {
    mapProcedureError(error);
  }

  if (updated) {
    await notificationRepository.create({
      userId: ticket.clientId,
      type: NotificationType.TICKET_RETURNED,
      ticketId: updated.id,
      actorId: technicianId,
      message: `Técnico retornou o chamado para a fila.`,
    }, { actorId: technicianId, requestId });
  }

  return updated as Ticket;
}

export async function finishTicket(ticketId: number, technicianId: number, resolutionNote?: string, requestId?: string): Promise<Ticket> {
  const ticket = await ticketRepository.findById(ticketId);
  if (!ticket) throw new ValidationError('Chamado não encontrado.', { code: 'TICKET_NOT_FOUND' });
  if (ticket.technicianId !== technicianId || ticket.status !== TicketStatus.IN_PROGRESS) {
    throw new ValidationError('Somente chamados em andamento por você podem ser finalizados.', { code: 'INVALID_TICKET_STATE' });
  }

  let updated: Ticket | null;
  try {
    await ticketRepository.runLifecycleProcedure('sp_finish_ticket', [ticketId, technicianId, resolutionNote ?? null], {
      actorId: technicianId,
      requestId,
    });
    updated = await ticketRepository.findById(ticketId);
  } catch (error) {
    mapProcedureError(error);
  }

  if (updated) {
    await notificationRepository.create({
      userId: ticket.clientId,
      type: NotificationType.TICKET_RESOLVED,
      ticketId: updated.id,
      actorId: technicianId,
      message: 'Chamado concluído com sucesso.',
    }, { actorId: technicianId, requestId });
  }

  return updated as Ticket;
}

export async function cancelTicket(ticketId: number, clientId: number, requestId?: string): Promise<Ticket> {
  const ticket = await ticketRepository.findById(ticketId);
  if (!ticket) throw new ValidationError('Chamado não encontrado.', { code: 'TICKET_NOT_FOUND' });
  if (ticket.clientId !== clientId) throw new ValidationError('Você não pode cancelar este chamado.', { code: 'FORBIDDEN' });

  let updated: Ticket | null;
  try {
    await ticketRepository.runLifecycleProcedure('sp_cancel_ticket', [ticketId, clientId], {
      actorId: clientId,
      requestId,
    });
    updated = await ticketRepository.findById(ticketId);
  } catch (error) {
    mapProcedureError(error);
  }

  if (updated) {
    await notificationRepository.create({
      userId: ticket.clientId,
      type: NotificationType.TICKET_CANCELLED,
      ticketId: updated.id,
      actorId: clientId,
      message: 'Chamado cancelado.',
    }, { actorId: clientId, requestId });
  }

  return updated as Ticket;
}

async function techName(technicianId: number): Promise<string> {
  const technician = await userRepository.findById(technicianId);
  return technician?.name ?? 'Técnico';
}
