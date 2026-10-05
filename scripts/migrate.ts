import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { appConfig } from '../src/config/env';

const migrationDir = path.resolve(__dirname, '../db/migrations');

async function hasMigrationBeenApplied(connection: mysql.Connection, migrationName: string): Promise<boolean> {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      migration_name VARCHAR(255) NOT NULL PRIMARY KEY,
      applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const [rows] = await connection.query(
    'SELECT 1 FROM schema_migrations WHERE migration_name = ? LIMIT 1',
    [migrationName],
  ) as [Array<{ 1: number }>, unknown];

  return rows.length > 0;
}

async function markMigrationApplied(connection: mysql.Connection, migrationName: string): Promise<void> {
  await connection.query(
    'INSERT INTO schema_migrations (migration_name) VALUES (?) ON DUPLICATE KEY UPDATE migration_name = VALUES(migration_name)',
    [migrationName],
  );
}

async function migrationAlreadyPresent(connection: mysql.Connection, migrationName: string): Promise<boolean> {
  const checks: Record<string, string> = {
    '002_create_sp_assume_ticket.sql': "SELECT COUNT(*) AS total FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = DATABASE() AND ROUTINE_NAME = 'sp_assume_ticket'",
    '003_create_sp_return_ticket.sql': "SELECT COUNT(*) AS total FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = DATABASE() AND ROUTINE_NAME = 'sp_return_ticket'",
    '004_create_sp_finish_ticket.sql': "SELECT COUNT(*) AS total FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = DATABASE() AND ROUTINE_NAME = 'sp_finish_ticket'",
    '005_create_sp_cancel_ticket.sql': "SELECT COUNT(*) AS total FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = DATABASE() AND ROUTINE_NAME = 'sp_cancel_ticket'",
    '006_create_sp_deactivate_technician.sql': "SELECT COUNT(*) AS total FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = DATABASE() AND ROUTINE_NAME = 'sp_deactivate_technician'",
    '007_create_ticket_update_trigger.sql': "SELECT COUNT(*) AS total FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE() AND TRIGGER_NAME = 'trg_tickets_before_update'",
    '008_create_ticket_comment_trigger.sql': "SELECT COUNT(*) AS total FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE() AND TRIGGER_NAME = 'trg_ticket_comments_before_insert'",
    '009_create_technician_stats_trigger.sql': "SELECT COUNT(*) AS total FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE() AND TRIGGER_NAME = 'trg_users_after_insert'",
    '010_align_schema_with_official.sql': "SELECT COUNT(*) AS total FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'superuser_flag'",
    '011_create_socket_tickets.sql': "SELECT COUNT(*) AS total FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'socket_tickets'",
  };

  const sql = checks[migrationName];
  if (!sql) {
    return false;
  }

  const [rows] = await connection.query(sql) as [Array<{ total: number }>, unknown];
  return Number(rows[0]?.total ?? 0) > 0;
}

export async function runMigrations(): Promise<void> {
  const connection = await mysql.createConnection({
    host: appConfig.dbHost,
    port: appConfig.dbPort,
    user: appConfig.dbUser,
    password: appConfig.dbPassword,
    database: appConfig.dbName,
    multipleStatements: true,
  });

  try {
    const migrationFiles = fs
      .readdirSync(migrationDir)
      .filter((file) => file.endsWith('.sql'))
      .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));

    for (const file of migrationFiles) {
      if (await hasMigrationBeenApplied(connection, file)) {
        continue;
      }

      if (await migrationAlreadyPresent(connection, file)) {
        await markMigrationApplied(connection, file);
        continue;
      }

      const sql = fs.readFileSync(path.join(migrationDir, file), 'utf8');
      await connection.query(sql);
      await markMigrationApplied(connection, file);
    }
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  void runMigrations()
    .then(() => {
      // eslint-disable-next-line no-console
      console.log('Migrations aplicadas com sucesso.');
    })
    .catch((error: unknown) => {
      // eslint-disable-next-line no-console
      console.error('Falha ao aplicar migrations.', error);
      process.exitCode = 1;
    });
}
