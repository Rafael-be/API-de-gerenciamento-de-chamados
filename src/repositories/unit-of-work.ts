import type { PoolConnection } from 'mysql2/promise';
import { mysqlPool } from '../config/database';

export interface UnitOfWorkContext {
  actorId?: number | null;
  requestId?: string | null;
}

export class MysqlUnitOfWork {
  async run<T>(
    context: UnitOfWorkContext,
    operation: (connection: PoolConnection) => Promise<T>,
  ): Promise<T> {
    const connection = await mysqlPool.getConnection();

    try {
      await connection.beginTransaction();
      await connection.execute('SET @app_actor_id = ?, @app_request_id = ?', [
        context.actorId ?? null,
        context.requestId ?? null,
      ]);
      const result = await operation(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
}

export const unitOfWork = new MysqlUnitOfWork();
