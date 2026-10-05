import crypto from 'node:crypto';
import { NotificationType, Role, TicketStatus } from '../domain/enums';
import type { Ticket } from '../domain/models';
import { ValidationError } from '../errors/app-error';
import { notificationRepository, ticketRepository, userRepository } from '../repositories';

export async function createTicket(input: { clientId: number; sectorId: number | null; title: string; description: string }): Promise<Ticket> {
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
  } as any);
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

export async function updateTicket(ticketId: number, patch: Partial<Ticket>): Promise<Ticket | null> {
  return ticketRepository.update(ticketId, patch);
}

export async function assumeTicket(ticketId: number, technicianId: number): Promise<Ticket> {
  const ticket = await ticketRepository.findById(ticketId);
  if (!ticket) throw new ValidationError('Chamado não encontrado.', { code: 'TICKET_NOT_FOUND' });
  if (ticket.status !== TicketStatus.OPEN) throw new ValidationError('Somente chamados abertos podem ser assumidos.', { code: 'INVALID_TICKET_STATE' });

  const ticketUpdated = await ticketRepository.update(ticketId, {
    technicianId,
    status: TicketStatus.IN_PROGRESS,
    assumedAt: new Date().toISOString(),
  });

  if (ticketUpdated) {
    const client = await userRepository.findById(ticket.clientId);
    if (client) {
      await notificationRepository.create({
        userId: client.id,
        type: NotificationType.TICKET_ASSUMED,
        ticketId: ticketUpdated.id,
        actorId: technicianId,
        message: `Chamado assumido por ${techName(technicianId)}.`,
      });
    }
  }

  return ticketUpdated as Ticket;
}

export async function returnTicket(ticketId: number, technicianId: number): Promise<Ticket> {
  const ticket = await ticketRepository.findById(ticketId);
  if (!ticket) throw new ValidationError('Chamado não encontrado.', { code: 'TICKET_NOT_FOUND' });
  if (ticket.technicianId !== technicianId || ticket.status !== TicketStatus.IN_PROGRESS) {
    throw new ValidationError('Este chamado não pode ser devolvido neste estado.', { code: 'INVALID_TICKET_STATE' });
  }

  const updated = await ticketRepository.update(ticketId, {
    technicianId: null,
    status: TicketStatus.OPEN,
    assumedAt: null,
  });

  if (updated) {
    await notificationRepository.create({
      userId: ticket.clientId,
      type: NotificationType.TICKET_RETURNED,
      ticketId: updated.id,
      actorId: technicianId,
      message: `Técnico retornou o chamado para a fila.`,
    });
  }

  return updated as Ticket;
}

export async function finishTicket(ticketId: number, technicianId: number, resolutionNote?: string): Promise<Ticket> {
  const ticket = await ticketRepository.findById(ticketId);
  if (!ticket) throw new ValidationError('Chamado não encontrado.', { code: 'TICKET_NOT_FOUND' });
  if (ticket.technicianId !== technicianId || ticket.status !== TicketStatus.IN_PROGRESS) {
    throw new ValidationError('Somente chamados em andamento por você podem ser finalizados.', { code: 'INVALID_TICKET_STATE' });
  }

  const updated = await ticketRepository.update(ticketId, {
    status: TicketStatus.RESOLVED,
    resolutionNote: resolutionNote ?? null,
    resolvedAt: new Date().toISOString(),
  });

  if (updated) {
    await notificationRepository.create({
      userId: ticket.clientId,
      type: NotificationType.TICKET_RESOLVED,
      ticketId: updated.id,
      actorId: technicianId,
      message: 'Chamado concluído com sucesso.',
    });
  }

  return updated as Ticket;
}

export async function cancelTicket(ticketId: number, clientId: number): Promise<Ticket> {
  const ticket = await ticketRepository.findById(ticketId);
  if (!ticket) throw new ValidationError('Chamado não encontrado.', { code: 'TICKET_NOT_FOUND' });
  if (ticket.clientId !== clientId) throw new ValidationError('Você não pode cancelar este chamado.', { code: 'FORBIDDEN' });

  const updated = await ticketRepository.update(ticketId, {
    status: TicketStatus.CANCELLED,
    cancelledAt: new Date().toISOString(),
    technicianId: ticket.technicianId && ticket.status === TicketStatus.IN_PROGRESS ? null : ticket.technicianId,
  });

  if (updated) {
    await notificationRepository.create({
      userId: ticket.clientId,
      type: NotificationType.TICKET_CANCELLED,
      ticketId: updated.id,
      actorId: clientId,
      message: 'Chamado cancelado.',
    });
  }

  return updated as Ticket;
}

async function techName(technicianId: number): Promise<string> {
  const technician = await userRepository.findById(technicianId);
  return technician?.name ?? 'Técnico';
}
