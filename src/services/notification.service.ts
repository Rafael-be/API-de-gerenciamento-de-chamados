import crypto from 'node:crypto';
import { appConfig } from '../config/env';
import { hashToken } from '../auth/session';
import { notificationRepository, socketTicketRepository } from '../repositories';
import type { UnitOfWorkContext } from '../repositories/unit-of-work';

export async function getNotificationsForUser(userId: number) {
  return notificationRepository.findByUser(userId);
}

export async function getUnreadCount(userId: number): Promise<number> {
  return notificationRepository.countUnread(userId);
}

export async function readNotification(notificationId: number, userId: number, context: UnitOfWorkContext = {}) {
  return notificationRepository.markRead(notificationId, userId, context);
}

export async function readAllNotifications(userId: number, context: UnitOfWorkContext = {}): Promise<number> {
  return notificationRepository.markAllRead(userId, context);
}

export async function issueSocketTicketForUser(userId: number, requestId?: string): Promise<{ ticket: string; expiresAt: number; expiresInSeconds: number }> {
  const ticket = crypto.randomBytes(24).toString('hex');
  const expiresInSeconds = appConfig.socketTicketTtlSeconds;
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000);
  await socketTicketRepository.create(userId, hashToken(ticket), expiresAt, { actorId: userId, requestId });
  return { ticket, expiresAt: expiresAt.getTime(), expiresInSeconds };
}

export async function consumeSocketTicket(ticket: string): Promise<number | null> {
  return socketTicketRepository.consume(hashToken(ticket));
}
