import type { RowDataPacket } from 'mysql2/promise';
import { mysqlPool } from '../../config/database';
import type { RefreshTokenRecordRow } from '../interfaces';

export const refreshTokenRepository = {
  async create(userId: number, familyId: string, tokenHash: string, expiresAt: Date): Promise<{ id: number }> {
    const values: any[] = [userId, familyId, tokenHash, expiresAt.toISOString().slice(0, 19).replace('T', ' ')];
    const [result] = await mysqlPool.execute<any>(
      'INSERT INTO refresh_tokens (user_id, family_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, NOW())',
      values as any,
    );
    return { id: Number(result.insertId) };
  },

  async findByHash(tokenHash: string): Promise<{ id: number; userId: number; familyId: string; tokenHash: string; expiresAt: Date; revokedAt: Date | null; rotatedAt: Date | null } | null> {
    const [rows] = await mysqlPool.query<RowDataPacket[]>('SELECT * FROM refresh_tokens WHERE token_hash = ?', [tokenHash]);
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

  async revoke(id: number): Promise<void> {
    await mysqlPool.execute('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = ?', [id]);
  },
};
