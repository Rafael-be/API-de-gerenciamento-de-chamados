import { type Request, type Response, Router } from 'express';
import { z } from 'zod';
import {
  createCommentRecord,
  createNotificationRecord,
  getCommentById,
  getTicketById,
  listCommentsByTicket,
  updateCommentRecord,
} from '../auth/session';
import { NotificationType, Role } from '../domain/enums';
import { emitNotificationToUser } from '../socket/notifications';
import { ValidationError } from '../errors/app-error';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';

const commentRouter = Router();

const commentCreateSchema = z.object({
  body: z.string().trim().min(1, 'Comentário não pode ficar vazio.').max(2000, 'Comentário muito longo.'),
  parentId: z.coerce.number().int().positive().nullable().optional(),
});

const commentUpdateSchema = z.object({
  body: z.string().trim().min(1, 'Comentário não pode ficar vazio.').max(2000, 'Comentário muito longo.'),
});

function canAccessTicketForComment(ticket: { clientId: number; technicianId: number | null; status: string }, user: AuthenticatedRequest['user']): boolean {
  if (!user) {
    return false;
  }

  if (user.role === Role.CLIENT) {
    return ticket.clientId === user.id;
  }

  if (user.role === Role.TECHNICIAN) {
    return ticket.technicianId === user.id || ticket.status === 'OPEN';
  }

  return false;
}

commentRouter.get('/tickets/:id/comments', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const ticketId = Number(req.params.id);
  if (!Number.isInteger(ticketId) || ticketId <= 0) {
    throw new ValidationError('Identificador do ticket inválido.');
  }

  const ticket = getTicketById(ticketId);
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

  if (!canAccessTicketForComment(ticket, req.user)) {
    res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Você não pode ver os comentários deste chamado.',
      },
    });
    return;
  }

  const items = listCommentsByTicket(ticketId);
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

commentRouter.post('/tickets/:id/comments', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const ticketId = Number(req.params.id);
  if (!Number.isInteger(ticketId) || ticketId <= 0) {
    throw new ValidationError('Identificador do ticket inválido.');
  }

  const ticket = getTicketById(ticketId);
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

  if (!canAccessTicketForComment(ticket, req.user)) {
    res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Você não pode comentar neste chamado.',
      },
    });
    return;
  }

  const parsed = commentCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Dados do comentário inválidos.', { issues: parsed.error.flatten() });
  }

  if (parsed.data.parentId !== undefined && parsed.data.parentId !== null) {
    const parent = getCommentById(parsed.data.parentId);
    if (!parent || parent.ticketId !== ticketId) {
      throw new ValidationError('Resposta inválida para este chamado.', { code: 'INVALID_COMMENT_PARENT' });
    }

    if (parent.parentId !== null) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_COMMENT_PARENT',
          message: 'Comentários só permitem uma resposta por nível.',
          details: null,
        },
      });
      return;
    }
  }

  const comment = createCommentRecord({
    ticketId,
    authorId: req.user!.id,
    parentId: parsed.data.parentId ?? null,
    body: parsed.data.body,
  });

  const targets = new Set<number>();
  const otherUserId = ticket.clientId === req.user!.id ? ticket.technicianId : ticket.clientId;

  if (otherUserId !== null) {
    targets.add(otherUserId);
  }

  if (ticket.technicianId !== null && ticket.technicianId !== req.user!.id) {
    targets.add(ticket.technicianId);
  }

  if (ticket.clientId !== req.user!.id) {
    targets.add(ticket.clientId);
  }

  for (const targetUserId of targets) {
    const notification = createNotificationRecord({
      userId: targetUserId,
      type: NotificationType.COMMENT_CREATED,
      ticketId,
      commentId: comment.id,
      actorId: req.user!.id,
      message: `Novo comentário no chamado "${ticket.title}".`,
    });
    emitNotificationToUser(targetUserId, notification);
  }

  res.status(201).json({
    success: true,
    data: {
      comment,
    },
  });
});

commentRouter.patch('/comments/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const commentId = Number(req.params.id);
  if (!Number.isInteger(commentId) || commentId <= 0) {
    throw new ValidationError('Identificador do comentário inválido.');
  }

  const comment = getCommentById(commentId);
  if (!comment) {
    res.status(404).json({
      success: false,
      error: {
        code: 'COMMENT_NOT_FOUND',
        message: 'Comentário não encontrado.',
      },
    });
    return;
  }

  if (comment.authorId !== req.user?.id) {
    res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Você só pode editar seus próprios comentários.',
      },
    });
    return;
  }

  const parsed = commentUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ValidationError('Dados do comentário inválidos.', { issues: parsed.error.flatten() });
  }

  const updated = updateCommentRecord(commentId, {
    body: parsed.data.body,
    editedAt: new Date().toISOString(),
  });

  res.json({
    success: true,
    data: {
      comment: updated,
    },
  });
});

commentRouter.delete('/comments/:id', requireAuth, (req: AuthenticatedRequest, res: Response) => {
  const commentId = Number(req.params.id);
  if (!Number.isInteger(commentId) || commentId <= 0) {
    throw new ValidationError('Identificador do comentário inválido.');
  }

  const comment = getCommentById(commentId);
  if (!comment) {
    res.status(404).json({
      success: false,
      error: {
        code: 'COMMENT_NOT_FOUND',
        message: 'Comentário não encontrado.',
      },
    });
    return;
  }

  if (comment.authorId !== req.user?.id) {
    res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Você só pode excluir seus próprios comentários.',
      },
    });
    return;
  }

  const updated = updateCommentRecord(commentId, {
    deletedAt: new Date().toISOString(),
  });

  res.json({
    success: true,
    data: {
      comment: updated,
    },
  });
});

export default commentRouter;
