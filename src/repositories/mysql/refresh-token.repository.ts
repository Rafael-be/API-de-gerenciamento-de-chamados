import type { ExecuteValues, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { mysqlPool } from '../../config/database';
import type { RefreshTokenRecordRow } from '../interfaces';
import { unitOfWork, type UnitOfWorkContext } from '../unit-of-work';

export const refreshTokenRepository = {
  async create(userId: number, familyId: string, tokenHash: string, expiresAt: Date, context: UnitOfWorkContext = {}): Promise<{ id: number }> {
    const values: ExecuteValues[] = [userId, familyId, tokenHash, expiresAt.toISOString().slice(0, 19).replace('T', ' ')];
    const id = await unitOfWork.run(context, async (connection) => {
      const [result] = await connection.execute<ResultSetHeader>(
        'INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, NOW())',
        values,
      );
      return Number(result.insertId);
    });
    return { id };
  },

  async findByHash(tokenHash: string): Promise<{ id: number; userId: number; familyId: string; tokenHash: string; expiresAt: Date; revokedAt: Date | null; rotatedAt: Date | null } | null> {
    const [rows] = await mysqlPool.query<RowDataPacket[]>(
      'SELECT id, user_id, family_id, token_hash, expires_at, rotated_at, revoked_at, created_at FROM refresh_tokens WHERE token_hash = ?',
      [tokenHash],
    );
    const row = rows[0] as RefreshTokenRecordRow | undefined;
    if (!row) return null;
    return {
      id: row.id,
      userId: row.user_id,
      familyId: row.family_id,
      tokenHash: row.token_hash,
      expiresAt: new Date(row.expires_at),
      revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
      rotatedAt: row.rotated_at ? new Date(row.rotated_at) : null,
    };
  },

  async revoke(id: number, context: UnitOfWorkContext = {}): Promise<void> {
    await unitOfWork.run(context, async (connection) => {
      await connection.execute('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ?', [id]);
    });
  },
};
