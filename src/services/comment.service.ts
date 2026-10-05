import { NotificationType } from '../domain/enums';
import type { TicketComment } from '../domain/models';
import { commentRepository, notificationRepository, ticketRepository } from '../repositories';

export async function getCommentByIdForValidation(commentId: number): Promise<TicketComment | null> {
  return commentRepository.findById(commentId);
}

export async function listCommentsForTicket(ticketId: number): Promise<TicketComment[]> {
  return commentRepository.findByTicket(ticketId);
}

export async function createComment(input: { ticketId: number; authorId: number; body: string; parentId?: number | null }): Promise<TicketComment> {
  const parentId = input.parentId ?? null;
  if (parentId !== null) {
    const parent = await commentRepository.findById(parentId);
    if (!parent || parent.ticketId !== input.ticketId) throw new Error('INVALID_COMMENT_PARENT');
    if (parent.parentId !== null) throw new Error('INVALID_COMMENT_PARENT');
  }

  const comment = await commentRepository.create({
    ticketId: input.ticketId,
    authorId: input.authorId,
    parentId,
    body: input.body,
  });

  const ticket = await ticketRepository.findById(input.ticketId);
  if (ticket) {
    const targets = new Set<number>();
    const otherUserId = ticket.clientId === input.authorId ? ticket.technicianId : ticket.clientId;
    if (otherUserId !== null) targets.add(otherUserId);
    if (ticket.technicianId !== null && ticket.technicianId !== input.authorId) targets.add(ticket.technicianId);
    if (ticket.clientId !== input.authorId) targets.add(ticket.clientId);

    for (const targetUserId of targets) {
      await notificationRepository.create({
        userId: targetUserId,
        type: NotificationType.COMMENT_CREATED,
        ticketId: ticket.id,
        commentId: comment.id,
        actorId: input.authorId,
        message: `Novo comentário no chamado "${ticket.title}".`,
      });
    }
  }

  return comment;
}

export async function updateComment(commentId: number, body: string): Promise<TicketComment | null> {
  return commentRepository.update(commentId, { body, editedAt: new Date().toISOString() });
}

export async function deleteComment(commentId: number): Promise<TicketComment | null> {
  return commentRepository.delete(commentId);
}
