import type { RowDataPacket } from 'mysql2/promise';
import { mysqlPool } from '../../config/database';
import type { Sector } from '../../domain/models';
import type { SectorRecordRow } from '../interfaces';

function mapSector(row: SectorRecordRow): Sector {
  return {
    id: row.id,
    name: row.name,
    isActive: Boolean(row.is_active),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const sectorRepository = {
  async findById(id: number): Promise<Sector | null> {
    const [rows] = await mysqlPool.query<RowDataPacket[]>('SELECT * FROM sectors WHERE id = ?', [id]);
    const row = rows[0] as SectorRecordRow | undefined;
    return row ? mapSector(row) : null;
  },

  async findActive(): Promise<Sector[]> {
    const [rows] = await mysqlPool.query<RowDataPacket[]>('SELECT * FROM sectors WHERE is_active = 1 ORDER BY id ASC');
    return (rows as SectorRecordRow[]).map(mapSector);
  },

  async findAll(): Promise<Sector[]> {
    const [rows] = await mysqlPool.query<RowDataPacket[]>('SELECT * FROM sectors ORDER BY id ASC');
    return (rows as SectorRecordRow[]).map(mapSector);
  },

  async create(name: string, isActive = true): Promise<Sector> {
    const params: any[] = [name, isActive ? 1 : 0];
    const [result] = await mysqlPool.execute<any>('INSERT INTO sectors (name, is_active) VALUES (?, ?)', params as any);
    return (await this.findById(Number(result.insertId))) as Sector;
  },

  async update(id: number, patch: Partial<Sector>): Promise<Sector | null> {
    const entries: string[] = [];
    const values: any[] = [];

    if (patch.name !== undefined) { entries.push('name = ?'); values.push(patch.name); }
    if (patch.isActive !== undefined) { entries.push('is_active = ?'); values.push(patch.isActive ? 1 : 0); }

    if (entries.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    await mysqlPool.execute(`UPDATE sectors SET ${entries.join(', ')}, updated_at = NOW() WHERE id = ?`, values as any);
    return this.findById(id);
  },
};
