import { notificationRepository } from '../repositories';

export async function getNotificationsForUser(userId: number) {
  return notificationRepository.findByUser(userId);
}

export async function getUnreadCount(userId: number): Promise<number> {
  return notificationRepository.countUnread(userId);
}

export async function readNotification(notificationId: number, userId: number) {
  return notificationRepository.markRead(notificationId, userId);
}

export async function readAllNotifications(userId: number): Promise<number> {
  return notificationRepository.markAllRead(userId);
}

export async function issueSocketTicketForUser(userId: number): Promise<{ ticket: string; expiresAt: number; expiresInSeconds: number }> {
  const ticket = cryptoRandom(24);
  return {
    ticket,
    expiresAt: Date.now() + 30_000,
    expiresInSeconds: 30,
  };
}

function cryptoRandom(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i += 1) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}
