import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import { mysqlPool } from '../../config/database';
import { Role, UserStatus } from '../../domain/enums';
import type { User } from '../../domain/models';
import type { UserRecordRow } from '../interfaces';

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
    const [rows] = await mysqlPool.query<RowDataPacket[]>('SELECT * FROM users WHERE id = ?', [id]);
    const row = rows[0] as UserRecordRow | undefined;
    return row ? mapUser(row) : null;
  },

  async findByEmail(email: string): Promise<User | null> {
    const [rows] = await mysqlPool.query<RowDataPacket[]>('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
    const row = rows[0] as UserRecordRow | undefined;
    return row ? mapUser(row) : null;
  },

  async listByRole(role: Role): Promise<User[]> {
    const [rows] = await mysqlPool.query<RowDataPacket[]>('SELECT * FROM users WHERE role = ? ORDER BY id ASC', [role]);
    return (rows as UserRecordRow[]).map(mapUser);
  },

  async create(input: Partial<User> & { email: string; passwordHash: string; role: Role }): Promise<User> {
    const values: any[] = [
      input.name,
      input.email.toLowerCase(),
      input.passwordHash,
      input.role,
      input.sectorId ?? null,
      input.isActive ?? true,
      input.mustChangePassword ? 1 : 0,
    ];

    const [result] = await mysqlPool.execute<ResultSetHeader>(
      `INSERT INTO users (name, email, password_hash, role, sector_id, is_active, must_change_password, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      values as any,
    );

    const userId = result.insertId;
    const created = await this.findById(Number(userId));
    if (!created) {
      throw new Error('USER_NOT_CREATED');
    }
    return created;
  },

  async update(id: number, patch: Partial<User>): Promise<User | null> {
    const entries: string[] = [];
    const values: any[] = [];

    if (patch.name !== undefined) { entries.push('name = ?'); values.push(patch.name); }
    if (patch.email !== undefined) { entries.push('email = ?'); values.push(patch.email.toLowerCase()); }
    if (patch.passwordHash !== undefined) { entries.push('password_hash = ?'); values.push(patch.passwordHash); }
    if (patch.role !== undefined) { entries.push('role = ?'); values.push(patch.role); }
    if (patch.sectorId !== undefined) { entries.push('sector_id = ?'); values.push(patch.sectorId ?? null); }
    if (patch.isActive !== undefined) { entries.push('is_active = ?'); values.push(patch.isActive ? 1 : 0); }
    if (patch.mustChangePassword !== undefined) { entries.push('must_change_password = ?'); values.push(patch.mustChangePassword ? 1 : 0); }
    if (patch.passwordChangedAt !== undefined) { entries.push('password_changed_at = ?'); values.push(patch.passwordChangedAt); }
    if (patch.lastLoginAt !== undefined) { entries.push('last_login_at = ?'); values.push(patch.lastLoginAt); }
    if (patch.status !== undefined) { entries.push('is_active = ?'); values.push(patch.status === UserStatus.ACTIVE ? 1 : 0); }

    if (entries.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    await mysqlPool.execute(`UPDATE users SET ${entries.join(', ')}, updated_at = NOW() WHERE id = ?`, values as any);
    return this.findById(id);
  },
};
