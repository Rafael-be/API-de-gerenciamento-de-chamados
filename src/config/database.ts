import mysql from 'mysql2';
import {
  type ExecuteValues,
  type Pool,
  type PoolConnection,
  type QueryOptions,
  type QueryValues,
} from 'mysql2/promise';
import pino from 'pino';
import { appConfig } from './env';

const logger = pino({ level: appConfig.logLevel });
const sslConfig = appConfig.dbSsl
  ? appConfig.dbSslCa
    ? { ca: appConfig.dbSslCa }
    : {}
  : undefined;

const rawPool = mysql.createPool({
  host: appConfig.dbHost,
  port: appConfig.dbPort,
  user: appConfig.dbUser,
  password: appConfig.dbPassword,
  database: appConfig.dbName,
  timezone: 'Z',
  waitForConnections: true,
  connectionLimit: appConfig.dbPoolLimit,
  queueLimit: 0,
  namedPlaceholders: true,
  ssl: sslConfig,
});

rawPool.on('connection', (connection) => {
  connection.query("SET time_zone = '+00:00'", (error) => {
    if (error) {
      const errorCode = 'code' in error ? String(error.code) : 'ERRO_DESCONHECIDO';
      logger.error(
        { errorCode, host: appConfig.dbHost, port: appConfig.dbPort, database: appConfig.dbName },
        'Falha ao configurar o fuso horário da conexão MySQL.',
      );
      connection.destroy();
    }
  });
});

export const mysqlPool: Pool = rawPool.promise();

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

export const query = (sql: string, values: QueryValues[] = []) => mysqlPool.query(sql, values);
export const execute = (sql: string, values: ExecuteValues[] = []) => mysqlPool.execute(sql, values);

export async function pingDatabase(): Promise<void> {
  const connection = await mysqlPool.getConnection();

  try {
    await connection.query('SELECT 1');
  } finally {
    connection.release();
  }
}

export type Query = QueryOptions;
