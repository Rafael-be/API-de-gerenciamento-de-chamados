import type { ExecuteValues, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { mysqlPool } from '../../config/database';
import { NotificationType } from '../../domain/enums';
import type { Notification } from '../../domain/models';
import type { NotificationRecordRow } from '../interfaces';
import { unitOfWork, type UnitOfWorkContext } from '../unit-of-work';

interface CountRow extends RowDataPacket {
  total: number;
}

const notificationColumns = 'id, user_id, type, ticket_id, comment_id, actor_id, message, is_read, read_at, created_at';

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
    const [rows] = await mysqlPool.query<RowDataPacket[]>(`SELECT ${notificationColumns} FROM notifications WHERE user_id = ? ORDER BY created_at DESC`, [userId]);
    return (rows as NotificationRecordRow[]).map(mapNotification);
  },

  async countUnread(userId: number): Promise<number> {
    const [rows] = await mysqlPool.query<CountRow[]>('SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND is_read = 0', [userId]);
    return Number(rows[0]?.total ?? 0);
  },

  async create(input: Partial<Notification> & { userId: number; type: NotificationType; message: string }, context: UnitOfWorkContext = {}): Promise<Notification> {
    const values: ExecuteValues[] = [input.userId, input.type, input.ticketId ?? null, input.commentId ?? null, input.actorId ?? null, input.message, input.isRead ? 1 : 0, input.isRead ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null];
    const notificationId = await unitOfWork.run(context, async (connection) => {
      const [result] = await connection.execute<ResultSetHeader>(
        'INSERT INTO notifications (user_id, type, ticket_id, comment_id, actor_id, message, is_read, read_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())',
        values,
      );
      return Number(result.insertId);
    });
    const created = await this.findById(notificationId);
    if (!created) throw new Error('NOTIFICATION_NOT_CREATED');
    return created;
  },

  async findById(id: number): Promise<Notification | null> {
    const [rows] = await mysqlPool.query<RowDataPacket[]>(`SELECT ${notificationColumns} FROM notifications WHERE id = ?`, [id]);
    const row = rows[0] as NotificationRecordRow | undefined;
    return row ? mapNotification(row) : null;
  },

  async markRead(id: number, userId: number, context: UnitOfWorkContext = {}): Promise<Notification | null> {
    const affectedRows = await unitOfWork.run(context, async (connection) => {
      const [result] = await connection.execute<ResultSetHeader>(
        'UPDATE notifications SET is_read = 1, read_at = NOW() WHERE id = ? AND user_id = ?',
        [id, userId],
      );
      return result.affectedRows;
    });
    return affectedRows > 0 ? this.findById(id) : null;
  },

  async markAllRead(userId: number, context: UnitOfWorkContext = {}): Promise<number> {
    const affectedRows = await unitOfWork.run(context, async (connection) => {
      const [result] = await connection.execute<ResultSetHeader>('UPDATE notifications SET is_read = 1, read_at = NOW() WHERE user_id = ? AND is_read = 0', [userId]);
      return result.affectedRows;
    });
    return Number(affectedRows);
  },
};
