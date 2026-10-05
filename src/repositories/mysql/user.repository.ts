import type { ExecuteValues, RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { mysqlPool } from '../../config/database';
import { Role, UserStatus } from '../../domain/enums';
import type { User } from '../../domain/models';
import type { UserRecordRow } from '../interfaces';
import { unitOfWork, type UnitOfWorkContext } from '../unit-of-work';

function toMysqlDateTime(value: string | Date): string {
  return new Date(value).toISOString().slice(0, 19).replace('T', ' ');
}

const userColumns = 'id, name, email, password_hash, role, sector_id, is_active, must_change_password, password_changed_at, last_login_at, created_at, updated_at';

function mapUser(row: UserRecordRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role as Role,
    sectorId: row.sector_id,
    isActive: Boolean(row.is_active),
    mustChangePassword: Boolean(row.must_change_password),
    passwordChangedAt: row.password_changed_at,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.is_active ? UserStatus.ACTIVE : UserStatus.INACTIVE,
  };
}

export const userRepository = {
  async findById(id: number): Promise<User | null> {
    const [rows] = await mysqlPool.query<RowDataPacket[]>(`SELECT ${userColumns} FROM users WHERE id = ?`, [id]);
    const row = rows[0] as UserRecordRow | undefined;
    return row ? mapUser(row) : null;
  },

  async findByEmail(email: string): Promise<User | null> {
    const [rows] = await mysqlPool.query<RowDataPacket[]>(`SELECT ${userColumns} FROM users WHERE email = ?`, [email.toLowerCase()]);
    const row = rows[0] as UserRecordRow | undefined;
    return row ? mapUser(row) : null;
  },

  async listByRole(role: Role): Promise<User[]> {
    const [rows] = await mysqlPool.query<RowDataPacket[]>(`SELECT ${userColumns} FROM users WHERE role = ? ORDER BY id ASC`, [role]);
    return (rows as UserRecordRow[]).map(mapUser);
  },

  async create(
    input: Omit<Partial<User>, 'name'> & { name: string; email: string; passwordHash: string; role: Role },
    context: UnitOfWorkContext = {},
  ): Promise<User> {
    const values: ExecuteValues[] = [
      input.name,
      input.email.toLowerCase(),
      input.passwordHash,
      input.role,
      input.sectorId ?? null,
      input.isActive ?? true,
      input.mustChangePassword ? 1 : 0,
    ];

    const userId = await unitOfWork.run(context, async (connection) => {
      const [result] = await connection.execute<ResultSetHeader>(
        `INSERT INTO users (name, email, password_hash, role, sector_id, is_active, must_change_password, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        values,
      );
      return Number(result.insertId);
    });

    const created = await this.findById(userId);
    if (!created) {
      throw new Error('USER_NOT_CREATED');
    }
    return created;
  },

  async update(id: number, patch: Partial<User>, context: UnitOfWorkContext = {}): Promise<User | null> {
    const entries: string[] = [];
    const values: ExecuteValues[] = [];

    if (patch.name !== undefined) { entries.push('name = ?'); values.push(patch.name); }
    if (patch.email !== undefined) { entries.push('email = ?'); values.push(patch.email.toLowerCase()); }
    if (patch.passwordHash !== undefined) { entries.push('password_hash = ?'); values.push(patch.passwordHash); }
    if (patch.role !== undefined) { entries.push('role = ?'); values.push(patch.role); }
    if (patch.sectorId !== undefined) { entries.push('sector_id = ?'); values.push(patch.sectorId ?? null); }
    if (patch.isActive !== undefined) { entries.push('is_active = ?'); values.push(patch.isActive ? 1 : 0); }
    if (patch.mustChangePassword !== undefined) { entries.push('must_change_password = ?'); values.push(patch.mustChangePassword ? 1 : 0); }
    if (patch.passwordChangedAt !== undefined) { entries.push('password_changed_at = ?'); values.push(patch.passwordChangedAt ? toMysqlDateTime(patch.passwordChangedAt) : null); }
    if (patch.lastLoginAt !== undefined) { entries.push('last_login_at = ?'); values.push(patch.lastLoginAt ? toMysqlDateTime(patch.lastLoginAt) : null); }
    if (patch.status !== undefined) { entries.push('is_active = ?'); values.push(patch.status === UserStatus.ACTIVE ? 1 : 0); }

    if (entries.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    await unitOfWork.run(context, async (connection) => {
      await connection.execute(`UPDATE users SET ${entries.join(', ')}, updated_at = NOW() WHERE id = ?`, values);
    });
    return this.findById(id);
  },

  async deactivateTechnician(id: number, context: UnitOfWorkContext = {}): Promise<void> {
    await unitOfWork.run(context, async (connection) => {
      await connection.query('CALL sp_deactivate_technician(?)', [id]);
    });
  },
};
