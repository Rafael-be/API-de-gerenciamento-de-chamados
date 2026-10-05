import bcrypt from 'bcrypt';
import mysql from 'mysql2/promise';
import { appConfig } from '../src/config/env';

export async function seedSuperUser(): Promise<void> {
  const connection = await mysql.createConnection({
    host: appConfig.dbHost,
    port: appConfig.dbPort,
    user: appConfig.dbUser,
    password: appConfig.dbPassword,
    database: appConfig.dbName,
  });

  try {
    const passwordHash = await bcrypt.hash(appConfig.superuserPassword, appConfig.bcryptRounds);

    await connection.query(
      `INSERT INTO users (name, email, password_hash, role, is_active, must_change_password, password_changed_at, created_at, updated_at)
       VALUES (?, ?, ?, 'SUPERUSER', 1, 0, NOW(), NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         password_hash = VALUES(password_hash),
         is_active = 1,
         role = 'SUPERUSER',
         updated_at = NOW()`,
      [appConfig.superuserName, appConfig.superuserEmail, passwordHash],
    );
  } finally {
    await connection.end();
  }
}

if (require.main === module) {
  void seedSuperUser()
    .then(() => {
      // eslint-disable-next-line no-console
      console.log('Superusuário sincronizado com sucesso.');
    })
    .catch((error: unknown) => {
      // eslint-disable-next-line no-console
      console.error('Falha ao criar ou sincronizar o superusuário.', error);
      process.exitCode = 1;
    });
}
