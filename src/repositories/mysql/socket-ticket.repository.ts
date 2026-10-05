import type { ExecuteValues, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { unitOfWork, type UnitOfWorkContext } from '../unit-of-work';

interface SocketTicketRow extends RowDataPacket {
  user_id: number;
}

export const socketTicketRepository = {
  async create(userId: number, ticketHash: string, expiresAt: Date, context: UnitOfWorkContext = {}): Promise<void> {
    const values: ExecuteValues[] = [userId, ticketHash, expiresAt.toISOString().slice(0, 19).replace('T', ' ')];
    await unitOfWork.run(context, async (connection) => {
      await connection.execute(
        'INSERT INTO socket_tickets (user_id, ticket_hash, expires_at) VALUES (?, ?, ?)',
        values,
      );
    });
  },

  async consume(ticketHash: string): Promise<number | null> {
    return unitOfWork.run({}, async (connection) => {
      const [result] = await connection.execute<ResultSetHeader>(
        'UPDATE socket_tickets SET consumed_at = NOW() WHERE ticket_hash = ? AND consumed_at IS NULL AND expires_at > NOW()',
        [ticketHash],
      );
      if (result.affectedRows !== 1) return null;

      const [rows] = await connection.query<SocketTicketRow[]>(
        'SELECT user_id FROM socket_tickets WHERE ticket_hash = ? AND consumed_at IS NOT NULL',
        [ticketHash],
      );
      return rows[0]?.user_id ?? null;
    });
  },
};
