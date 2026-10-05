import mysql, { type Pool, type PoolConnection, type QueryOptions, type ResultSetHeader, type RowDataPacket } from 'mysql2/promise';
import { appConfig } from './env';

const sslConfig = appConfig.dbSsl && appConfig.dbSslCa ? { ca: appConfig.dbSslCa } : undefined;

export const mysqlPool: Pool = mysql.createPool({
  host: appConfig.dbHost,
  port: appConfig.dbPort,
  user: appConfig.dbUser,
  password: appConfig.dbPassword,
  database: appConfig.dbName,
  waitForConnections: true,
  connectionLimit: appConfig.dbPoolLimit,
  queueLimit: 0,
  namedPlaceholders: true,
  ssl: sslConfig,
});

export async function withTransaction<T>(handler: (connection: PoolConnection) => Promise<T>): Promise<T> {
  const connection = await mysqlPool.getConnection();

  try {
    await connection.beginTransaction();
    const result = await handler(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

export const query = async (sql: string, values: unknown[] = []): Promise<any> => mysqlPool.query(sql, values as any);
export const execute = async (sql: string, values: unknown[] = []): Promise<any> => mysqlPool.execute(sql, values as any);

export type Query = QueryOptions;
