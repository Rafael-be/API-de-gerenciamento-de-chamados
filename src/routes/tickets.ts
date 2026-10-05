import { type Request, type Response, Router } from 'express';
import { z } from 'zod';
import {
  cancelTicket,
  countTicketsByClient,
  createTicket,
  finishTicket,
  getTicket,
  listOpenTickets,
  listTicketsForClient,
  returnTicket,
  assumeTicket,
  updateTicket,
} from '../services/ticket.service';
import { NotificationType, Role, TicketStatus } from '../domain/enums';
import { ValidationError } from '../errors/app-error';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';

const ticketRouter = Router();

const createTicketSchema = z.object({
  title: z.string().trim().min(3, 'Título deve conter pelo menos 3 caracteres.'),
  description: z.string().trim().min(10, 'Descrição deve conter pelo menos 10 caracteres.'),
});

const updateTicketSchema = z.object({
  title: z.string().trim().min(3, 'Título deve conter pelo menos 3 caracteres.').optional(),
  description: z.string().trim().min(10, 'Descrição deve conter pelo menos 10 caracteres.').optional(),
});

const finishTicketSchema = z.object({
  resolutionNote: z.string().trim().max(500, 'Nota de resolução muito longa.').optional(),
});

function ensureOwner(ticket: { clientId: number }, userId: number): boolean {
  return ticket.clientId === userId;
}

function canViewTicketForUser(ticket: { clientId: number; technicianId: number | null; status: TicketStatus }, user: { id: number; role: Role }): boolean {
  if (user.role === Role.CLIENT) {
    return ensureOwner(ticket, user.id);
  }

  if (user.role === Role.TECHNICIAN) {
    if (ticket.technicianId === user.id) {
      return true;
    }

    return ticket.status === TicketStatus.OPEN;
  }

  return false;
}

ticketRouter.post('/tickets', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== Role.CLIENT) {
    res.status(401).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Apenas clientes podem abrir chamados.',
      },
    });
    return;
  }

  const parsed = createTicketSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Dados do chamado inválidos.', { issues: parsed.error.flatten() });
  }

  const ticket = await createTicket({
    clientId: req.user.id,
    sectorId: req.user.sectorId,
    title: parsed.data.title,
    description: parsed.data.description,
  });

  res.status(201).json({
    success: true,
    data: {
      ticket,
    },
  });
});

ticketRouter.get('/tickets', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== Role.CLIENT) {
    res.status(401).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Acesso restrito ao cliente.',
      },
    });
    return;
  }

  const tickets = await listTicketsForClient(req.user.id);
  res.json({
    success: true,
    data: {
      items: tickets,
      meta: {
        page: 1,
        limit: tickets.length || 50,
        total: tickets.length,
        totalPages: 1,
        hasNext: false,
      },
    },
  });
});

ticketRouter.get('/tickets/counts', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== Role.CLIENT) {
    res.status(401).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Acesso restrito ao cliente.',
      },
    });
    return;
  }

  res.json({
    success: true,
    data: await countTicketsByClient(req.user.id),
  });
});

ticketRouter.get('/technician/tickets', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== Role.TECHNICIAN) {
    res.status(401).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Acesso restrito ao técnico.',
      },
    });
    return;
  }

  const view = String(req.query.view ?? 'queue');
  let items: Awaited<ReturnType<typeof listOpenTickets>> = [];

  if (view === 'mine') {
    items = (await listTicketsForClient(req.user.id)).filter((ticket) => ticket.status === TicketStatus.IN_PROGRESS || ticket.status === TicketStatus.RESOLVED);
  } else if (view === 'done') {
    items = (await listTicketsForClient(req.user.id)).filter((ticket) => ticket.status === TicketStatus.RESOLVED);
  } else {
    items = await listOpenTickets();
  }

  res.json({
    success: true,
    data: {
      items,
      meta: {
        page: 1,
        limit: items.length || 50,
        total: items.length,
        totalPages: 1,
        hasNext: false,
      },
    },
  });
});

ticketRouter.get('/tickets/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const ticketId = Number(req.params.id);

  if (!Number.isInteger(ticketId) || ticketId <= 0) {
    throw new ValidationError('Identificador do chamado inválido.');
  }

  const ticket = await getTicket(ticketId);
  if (!ticket) {
    res.status(404).json({
      success: false,
      error: {
        code: 'TICKET_NOT_FOUND',
        message: 'Chamado não encontrado.',
      },
    });
    return;
  }

  if (!(await canViewTicketForUser(ticket, req.user ?? { id: -1, role: Role.CLIENT }))) {
    res.status(401).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Você não tem permissão para acessar este chamado.',
      },
    });
    return;
  }

  res.json({
    success: true,
    data: {
      ticket,
    },
  });
});

ticketRouter.patch('/tickets/:id', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const ticketId = Number(req.params.id);
  const parsed = updateTicketSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ValidationError('Dados do chamado inválidos.', { issues: parsed.error.flatten() });
  }

  const ticket = await getTicket(ticketId);
  if (!ticket) {
    res.status(404).json({
      success: false,
      error: {
        code: 'TICKET_NOT_FOUND',
        message: 'Chamado não encontrado.',
      },
    });
    return;
  }

  if (req.user?.role !== Role.CLIENT || !ensureOwner(ticket, req.user.id)) {
    res.status(401).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Você não pode editar este chamado.',
      },
    });
    return;
  }

  if (ticket.status !== TicketStatus.OPEN) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_TICKET_STATE',
        message: 'Apenas chamados abertos podem ser editados.',
      },
    });
    return;
  }

  const updated = await updateTicket(ticketId, {
    ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
    ...(parsed.data.description !== undefined ? { description: parsed.data.description } : {}),
  });

  res.json({
    success: true,
    data: {
      ticket: updated,
    },
  });
});

ticketRouter.post('/tickets/:id/cancel', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const ticketId = Number(req.params.id);
  const ticket = await getTicket(ticketId);

  if (!ticket) {
    res.status(404).json({
      success: false,
      error: {
        code: 'TICKET_NOT_FOUND',
        message: 'Chamado não encontrado.',
      },
    });
    return;
  }

  if (req.user?.role === Role.CLIENT && ensureOwner(ticket, req.user.id)) {
    const updated = await cancelTicket(ticketId, req.user.id);

    res.json({
      success: true,
      data: {
        ticket: updated,
      },
    });
    return;
  }

  res.status(401).json({
    success: false,
    error: {
      code: 'FORBIDDEN',
      message: 'Você não pode cancelar este chamado.',
    },
  });
});

ticketRouter.post('/tickets/:id/assume', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== Role.TECHNICIAN) {
    res.status(401).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Apenas técnicos podem assumir chamados.',
      },
    });
    return;
  }

  const ticketId = Number(req.params.id);
  const ticket = await getTicket(ticketId);

  if (!ticket) {
    res.status(404).json({
      success: false,
      error: {
        code: 'TICKET_NOT_FOUND',
        message: 'Chamado não encontrado.',
      },
    });
    return;
  }

  if (ticket.status !== TicketStatus.OPEN) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_TICKET_STATE',
        message: 'Somente chamados abertos podem ser assumidos.',
      },
    });
    return;
  }

  const updated = await assumeTicket(ticketId, req.user.id);

  res.json({
    success: true,
    data: {
      ticket: updated,
    },
  });
});

ticketRouter.post('/tickets/:id/return', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== Role.TECHNICIAN) {
    res.status(401).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Acesso restrito ao técnico.',
      },
    });
    return;
  }

  const ticket = await getTicket(Number(req.params.id));
  if (!ticket) {
    res.status(404).json({
      success: false,
      error: {
        code: 'TICKET_NOT_FOUND',
        message: 'Chamado não encontrado.',
      },
    });
    return;
  }

  if (ticket.technicianId !== req.user.id || ticket.status !== TicketStatus.IN_PROGRESS) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_TICKET_STATE',
        message: 'Este chamado não pode ser devolvido pela sua situação atual.',
      },
    });
    return;
  }

  const updated = await returnTicket(ticket.id, req.user.id);

  res.json({
    success: true,
    data: {
      ticket: updated,
    },
  });
});

ticketRouter.post('/tickets/:id/finish', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  if (req.user?.role !== Role.TECHNICIAN) {
    res.status(401).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Acesso restrito ao técnico.',
      },
    });
    return;
  }

  const ticket = await getTicket(Number(req.params.id));
  if (!ticket) {
    res.status(404).json({
      success: false,
      error: {
        code: 'TICKET_NOT_FOUND',
        message: 'Chamado não encontrado.',
      },
    });
    return;
  }

  const parsed = finishTicketSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    throw new ValidationError('Dados da resolução inválidos.', { issues: parsed.error.flatten() });
  }

  if (ticket.technicianId !== req.user.id || ticket.status !== TicketStatus.IN_PROGRESS) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_TICKET_STATE',
        message: 'Somente chamados em andamento por você podem ser finalizados.',
      },
    });
    return;
  }

  const updated = await finishTicket(ticket.id, req.user.id, parsed.data.resolutionNote ?? undefined);

  res.json({
    success: true,
    data: {
      ticket: updated,
    },
  });
});

export default ticketRouter;
