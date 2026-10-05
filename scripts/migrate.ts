import fs from 'node:fs';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { appConfig } from '../src/config/env';

const migrationDir = path.resolve(__dirname, '../db/migrations');

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
      const sql = fs.readFileSync(path.join(migrationDir, file), 'utf8');
      await connection.query(sql);
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
