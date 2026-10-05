import type { RowDataPacket } from 'mysql2/promise';
import { mysqlPool } from '../../config/database';
import { NotificationType } from '../../domain/enums';
import type { Notification } from '../../domain/models';
import type { NotificationRecordRow } from '../interfaces';

function mapNotification(row: NotificationRecordRow): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type as NotificationType,
    ticketId: row.ticket_id,
    commentId: row.comment_id,
    actorId: row.actor_id,
    message: row.message,
    isRead: Boolean(row.is_read),
    readAt: row.read_at,
    createdAt: row.created_at,
  };
}

export const notificationRepository = {
  async findByUser(userId: number): Promise<Notification[]> {
    const [rows] = await mysqlPool.query<RowDataPacket[]>('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC', [userId]);
    return (rows as NotificationRecordRow[]).map(mapNotification);
  },

  async countUnread(userId: number): Promise<number> {
    const [rows] = await mysqlPool.query<RowDataPacket[]>('SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND is_read = 0', [userId]);
    return Number((rows[0] as any)?.total ?? 0);
  },

  async create(input: Partial<Notification> & { userId: number; type: NotificationType; message: string }): Promise<Notification> {
    const values: any[] = [input.userId, input.type, input.ticketId ?? null, input.commentId ?? null, input.actorId ?? null, input.message, input.isRead ? 1 : 0, input.isRead ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null];
    const [result] = await mysqlPool.execute<any>(
      'INSERT INTO notifications (user_id, type, ticket_id, comment_id, actor_id, message, is_read, read_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())',
      values as any,
    );
    return (await this.findById(Number(result.insertId))) as Notification;
  },

  async findById(id: number): Promise<Notification | null> {
    const [rows] = await mysqlPool.query<RowDataPacket[]>('SELECT * FROM notifications WHERE id = ?', [id]);
    const row = rows[0] as NotificationRecordRow | undefined;
    return row ? mapNotification(row) : null;
  },

  async markRead(id: number, userId: number): Promise<Notification | null> {
    await mysqlPool.execute('UPDATE notifications SET is_read = 1, read_at = NOW() WHERE id = ? AND user_id = ?', [id, userId]);
    return this.findById(id);
  },

  async markAllRead(userId: number): Promise<number> {
    const [result] = await mysqlPool.execute<any>('UPDATE notifications SET is_read = 1, read_at = NOW() WHERE user_id = ? AND is_read = 0', [userId]);
    return Number(result.affectedRows ?? 0);
  },
};
