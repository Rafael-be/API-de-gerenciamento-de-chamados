import type { RowDataPacket } from 'mysql2/promise';
import { mysqlPool } from '../../config/database';
import { TicketStatus } from '../../domain/enums';
import type { Ticket } from '../../domain/models';
import type { TicketRecordRow } from '../interfaces';

function mapTicket(row: TicketRecordRow): Ticket {
  return {
    id: row.id,
    clientId: row.client_id,
    technicianId: row.technician_id,
    sectorId: row.sector_id,
    title: row.title,
    description: row.description,
    status: row.status as TicketStatus,
    resolutionNote: row.resolution_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    assumedAt: row.assumed_at,
    resolvedAt: row.resolved_at,
    cancelledAt: row.cancelled_at,
  };
}

export const ticketRepository = {
  async findById(id: number): Promise<Ticket | null> {
    const [rows] = await mysqlPool.query<RowDataPacket[]>('SELECT * FROM tickets WHERE id = ?', [id]);
    const row = rows[0] as TicketRecordRow | undefined;
    return row ? mapTicket(row) : null;
  },

  async findByClient(clientId: number): Promise<Ticket[]> {
    const [rows] = await mysqlPool.query<RowDataPacket[]>('SELECT * FROM tickets WHERE client_id = ? ORDER BY created_at DESC', [clientId]);
    return (rows as TicketRecordRow[]).map(mapTicket);
  },

  async findOpen(): Promise<Ticket[]> {
    const [rows] = await mysqlPool.query<RowDataPacket[]>('SELECT * FROM tickets WHERE status = ? ORDER BY created_at DESC', [TicketStatus.OPEN]);
    return (rows as TicketRecordRow[]).map(mapTicket);
  },

  async create(input: Partial<Ticket> & { clientId: number; sectorId: number | null; title: string; description: string; status: TicketStatus; technicianId?: number | null; resolutionNote?: string | null }): Promise<Ticket> {
    const values: any[] = [
      input.clientId,
      input.technicianId ?? null,
      input.sectorId ?? null,
      input.title,
      input.description,
      input.status,
      input.resolutionNote ?? null,
      input.assumedAt ?? null,
      input.resolvedAt ?? null,
      input.cancelledAt ?? null,
    ];
    const [result] = await mysqlPool.execute<any>(
      `INSERT INTO tickets (client_id, technician_id, sector_id, title, description, status, resolution_note, assumed_at, resolved_at, cancelled_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      values as any,
    );
    return (await this.findById(Number(result.insertId))) as Ticket;
  },

  async update(id: number, patch: Partial<Ticket>): Promise<Ticket | null> {
    const entries: string[] = [];
    const values: any[] = [];

    if (patch.clientId !== undefined) { entries.push('client_id = ?'); values.push(patch.clientId); }
    if (patch.technicianId !== undefined) { entries.push('technician_id = ?'); values.push(patch.technicianId ?? null); }
    if (patch.sectorId !== undefined) { entries.push('sector_id = ?'); values.push(patch.sectorId ?? null); }
    if (patch.title !== undefined) { entries.push('title = ?'); values.push(patch.title); }
    if (patch.description !== undefined) { entries.push('description = ?'); values.push(patch.description); }
    if (patch.status !== undefined) { entries.push('status = ?'); values.push(patch.status); }
    if (patch.resolutionNote !== undefined) { entries.push('resolution_note = ?'); values.push(patch.resolutionNote ?? null); }
    if (patch.assumedAt !== undefined) { entries.push('assumed_at = ?'); values.push(patch.assumedAt); }
    if (patch.resolvedAt !== undefined) { entries.push('resolved_at = ?'); values.push(patch.resolvedAt); }
    if (patch.cancelledAt !== undefined) { entries.push('cancelled_at = ?'); values.push(patch.cancelledAt); }

    if (!entries.length) {
      return this.findById(id);
    }

    values.push(id);
    await mysqlPool.execute(`UPDATE tickets SET ${entries.join(', ')}, updated_at = NOW() WHERE id = ?`, values as any);
    return this.findById(id);
  },
};
