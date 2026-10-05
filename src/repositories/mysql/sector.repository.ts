import type { ExecuteValues, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { mysqlPool } from '../../config/database';
import type { Sector } from '../../domain/models';
import type { SectorRecordRow } from '../interfaces';
import { unitOfWork, type UnitOfWorkContext } from '../unit-of-work';

const sectorColumns = 'id, name, is_active, created_at, updated_at';

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
    const [rows] = await mysqlPool.query<RowDataPacket[]>(`SELECT ${sectorColumns} FROM sectors WHERE id = ?`, [id]);
    const row = rows[0] as SectorRecordRow | undefined;
    return row ? mapSector(row) : null;
  },

  async findActive(): Promise<Sector[]> {
    const [rows] = await mysqlPool.query<RowDataPacket[]>(`SELECT ${sectorColumns} FROM sectors WHERE is_active = 1 ORDER BY id ASC`);
    return (rows as SectorRecordRow[]).map(mapSector);
  },

  async findAll(): Promise<Sector[]> {
    const [rows] = await mysqlPool.query<RowDataPacket[]>(`SELECT ${sectorColumns} FROM sectors ORDER BY id ASC`);
    return (rows as SectorRecordRow[]).map(mapSector);
  },

  async create(name: string, isActive = true, context: UnitOfWorkContext = {}): Promise<Sector> {
    const params: ExecuteValues[] = [name, isActive ? 1 : 0];
    const sectorId = await unitOfWork.run(context, async (connection) => {
      const [result] = await connection.execute<ResultSetHeader>('INSERT INTO sectors (name, is_active) VALUES (?, ?)', params);
      return Number(result.insertId);
    });
    const created = await this.findById(sectorId);
    if (!created) throw new Error('SECTOR_NOT_CREATED');
    return created;
  },

  async update(id: number, patch: Partial<Sector>, context: UnitOfWorkContext = {}): Promise<Sector | null> {
    const entries: string[] = [];
    const values: ExecuteValues[] = [];

    if (patch.name !== undefined) { entries.push('name = ?'); values.push(patch.name); }
    if (patch.isActive !== undefined) { entries.push('is_active = ?'); values.push(patch.isActive ? 1 : 0); }

    if (entries.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    await unitOfWork.run(context, async (connection) => {
      await connection.execute(`UPDATE sectors SET ${entries.join(', ')}, updated_at = NOW() WHERE id = ?`, values);
    });
    return this.findById(id);
  },
};
