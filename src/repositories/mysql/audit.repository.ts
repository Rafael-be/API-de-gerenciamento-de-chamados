import { unitOfWork } from '../unit-of-work';

export const auditLogRepository = {
  async create(input: { actorId?: number | null; action: string; entityType: string; entityId?: number | null; metadata?: Record<string, unknown> | null; requestId?: string | null; ip?: string | null; userAgent?: string | null }): Promise<void> {
    await unitOfWork.run({ actorId: input.actorId, requestId: input.requestId }, async (connection) => {
      await connection.execute(
        'INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, metadata, ip, user_agent, request_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())',
        [
          input.actorId ?? null,
          input.action,
          input.entityType,
          input.entityId ?? null,
          input.metadata ? JSON.stringify(input.metadata) : null,
          input.ip ?? null,
          input.userAgent ?? null,
          input.requestId ?? null,
        ],
      );
    });
  },
};
