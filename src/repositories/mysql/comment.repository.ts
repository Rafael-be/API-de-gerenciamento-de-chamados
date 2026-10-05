import type { RowDataPacket } from 'mysql2/promise';
import { mysqlPool } from '../../config/database';
import type { TicketComment } from '../../domain/models';
import type { CommentRecordRow } from '../interfaces';

function mapComment(row: CommentRecordRow): TicketComment {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    authorId: row.author_id,
    parentId: row.parent_id,
    body: row.body,
    editedAt: row.edited_at,
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
  };
}

export const commentRepository = {
  async findById(id: number): Promise<TicketComment | null> {
    const [rows] = await mysqlPool.query<RowDataPacket[]>('SELECT * FROM ticket_comments WHERE id = ?', [id]);
    const row = rows[0] as CommentRecordRow | undefined;
    return row ? mapComment(row) : null;
  },

  async findByTicket(ticketId: number): Promise<TicketComment[]> {
    const [rows] = await mysqlPool.query<RowDataPacket[]>('SELECT * FROM ticket_comments WHERE ticket_id = ? ORDER BY created_at ASC', [ticketId]);
    return (rows as CommentRecordRow[]).map(mapComment).filter((comment) => comment.deletedAt === null);
  },

  async create(input: Partial<TicketComment> & { ticketId: number; authorId: number; body: string }): Promise<TicketComment> {
    const values: any[] = [input.ticketId, input.authorId, input.parentId ?? null, input.body];
    const [result] = await mysqlPool.execute<any>(
      'INSERT INTO ticket_comments (ticket_id, author_id, parent_id, body, created_at) VALUES (?, ?, ?, ?, NOW())',
      values as any,
    );
    return (await this.findById(Number(result.insertId))) as TicketComment;
  },

  async update(id: number, patch: Partial<TicketComment>): Promise<TicketComment | null> {
    const entries: string[] = [];
    const values: any[] = [];

    if (patch.body !== undefined) { entries.push('body = ?'); values.push(patch.body); }
    if (patch.editedAt !== undefined) { entries.push('edited_at = ?'); values.push(patch.editedAt); }
    if (patch.deletedAt !== undefined) { entries.push('deleted_at = ?'); values.push(patch.deletedAt); }

    if (!entries.length) {
      return this.findById(id);
    }

    values.push(id);
    await mysqlPool.execute(`UPDATE ticket_comments SET ${entries.join(', ')} WHERE id = ?`, values as any);
    return this.findById(id);
  },

  async delete(id: number): Promise<TicketComment | null> {
    const existing = await this.findById(id);
    if (!existing) return null;
    await mysqlPool.execute('UPDATE ticket_comments SET deleted_at = NOW() WHERE id = ?', [id]);
    return this.findById(id);
  },
};
