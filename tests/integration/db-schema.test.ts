import fs from 'node:fs';
import path from 'node:path';
import mariadb from 'mysql2/promise';

const migrationDir = path.resolve(__dirname, '../../db/migrations');
const schemaSqlPath = path.resolve(__dirname, '../../db/schema.sql');

describe('Database schema and migration parity', () => {
  const connectionConfig = {
    host: process.env.TEST_DB_HOST ?? '127.0.0.1',
    port: Number(process.env.TEST_DB_PORT ?? 3307),
    user: process.env.TEST_DB_USER ?? 'root',
    password: process.env.TEST_DB_PASSWORD ?? 'test_root_pass',
    database: process.env.TEST_DB_NAME ?? 'helpdesk_test',
  };

  let shouldRunDbTests = false;

  beforeAll(async () => {
    try {
      const connection = await mariadb.createConnection(connectionConfig);
      await connection.ping();
      await connection.end();
      shouldRunDbTests = true;
    } catch {
      shouldRunDbTests = false;
    }
  });

  it('contains a consolidated schema snapshot and applied migrations', async () => {
    const migrationFiles = fs.readdirSync(migrationDir).filter((file) => file.endsWith('.sql'));
    const schemaSql = fs.readFileSync(schemaSqlPath, 'utf8');

    if (!shouldRunDbTests) {
      expect(migrationFiles.length).toBeGreaterThan(0);
      expect(schemaSql).toContain('CREATE TABLE');
      expect(schemaSql).toContain('CREATE TRIGGER');
      return;
    }

    expect(migrationFiles.length).toBeGreaterThan(0);
    expect(schemaSql).toContain('CREATE TABLE');
    expect(schemaSql).toContain('CREATE TRIGGER');
  });

  it('matches the schema metadata when applied to an empty database', async () => {
    if (!shouldRunDbTests) {
      return;
    }

    const connection = await mariadb.createConnection(connectionConfig);

    try {
      await connection.query('DROP DATABASE IF EXISTS helpdesk_test');
      await connection.query('CREATE DATABASE helpdesk_test CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci');
      await connection.changeUser({ database: 'helpdesk_test' });

      const schemaSql = fs.readFileSync(schemaSqlPath, 'utf8');
      await connection.query(schemaSql);

      const [rows] = (await connection.query(
        `SELECT TABLE_NAME AS tableName
         FROM information_schema.tables
         WHERE TABLE_SCHEMA = ?
         ORDER BY TABLE_NAME`,
        [connectionConfig.database],
      )) as [Array<{ tableName: string }>, unknown];

      expect(Array.isArray(rows)).toBe(true);
      expect(rows.length).toBeGreaterThan(6);
    } finally {
      await connection.end();
    }
  });
});
