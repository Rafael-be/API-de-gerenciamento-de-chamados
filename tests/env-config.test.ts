import { describe, it, expect } from '@jest/globals';
import { loadEnv } from '../src/config/env';

describe('Environment validation', () => {
  it('loads required variables and exposes them as config', () => {
    const env = loadEnv({
      NODE_ENV: 'development',
      PORT: '3000',
      LOG_LEVEL: 'debug',
      DB_HOST: '127.0.0.1',
      DB_PORT: '3306',
      DB_USER: 'helpdesk_user',
      DB_PASSWORD: 'helpdesk_pass',
      DB_NAME: 'helpdesk',
      DB_POOL_LIMIT: '10',
      DB_SSL: 'false',
      JWT_ACCESS_SECRET: 'long-secret-123456',
      JWT_ACCESS_TTL: '15m',
      REFRESH_TTL_DAYS: '30',
      REFRESH_GRACE_SECONDS: '20',
      BCRYPT_ROUNDS: '12',
      COOKIE_SECURE: 'false',
      CORS_ORIGINS: 'http://localhost:5173',
      TRUST_PROXY: 'false',
      SOCKET_TICKET_TTL_SECONDS: '30',
      SUPERUSER_NAME: 'Administrador',
      SUPERUSER_EMAIL: 'admin@helpdesk.local',
      SUPERUSER_PASSWORD: 'TroqueEstaSenha123',
      DEFAULT_RESET_PASSWORD: 'SenhaTeste123',
    });

    expect(env.port).toBe(3000);
    expect(env.jwtAccessSecret).toBe('long-secret-123456');
    expect(env.cookieSecure).toBe(false);
    expect(env.corsOrigins).toEqual(['http://localhost:5173']);
  });

  it('accepts boolean flags in true form and multiple CORS origins', () => {
    const env = loadEnv({
      NODE_ENV: 'production',
      PORT: '4000',
      LOG_LEVEL: 'info',
      DB_HOST: 'db.internal',
      DB_PORT: '3306',
      DB_USER: 'app_user',
      DB_PASSWORD: 'safePass123',
      DB_NAME: 'helpdesk',
      DB_POOL_LIMIT: '12',
      DB_SSL: true as unknown as string,
      JWT_ACCESS_SECRET: 'another-long-secret-12345',
      JWT_ACCESS_TTL: '30m',
      REFRESH_TTL_DAYS: '30',
      REFRESH_GRACE_SECONDS: '30',
      BCRYPT_ROUNDS: '12',
      COOKIE_SECURE: true as unknown as string,
      CORS_ORIGINS: 'http://localhost:5173,https://app.example.com',
      TRUST_PROXY: true as unknown as string,
      SOCKET_TICKET_TTL_SECONDS: '45',
      SUPERUSER_NAME: 'Admin',
      SUPERUSER_EMAIL: 'admin@example.com',
      SUPERUSER_PASSWORD: 'StrongPass123',
      DEFAULT_RESET_PASSWORD: 'ResetPassword123',
    });

    expect(env.dbSsl).toBe(true);
    expect(env.cookieSecure).toBe(true);
    expect(env.trustProxy).toBe(true);
    expect(env.corsOrigins).toEqual(['http://localhost:5173', 'https://app.example.com']);
  });

  it('uses false defaults when boolean flags are absent', () => {
    const env = loadEnv({
      NODE_ENV: 'test',
      PORT: '3100',
      LOG_LEVEL: 'debug',
      DB_HOST: '127.0.0.1',
      DB_PORT: '3306',
      DB_USER: 'helpdesk_user',
      DB_PASSWORD: 'helpdesk_pass',
      DB_NAME: 'helpdesk_test',
      DB_POOL_LIMIT: '10',
      JWT_ACCESS_SECRET: 'yet-another-long-secret-123',
      JWT_ACCESS_TTL: '15m',
      REFRESH_TTL_DAYS: '30',
      REFRESH_GRACE_SECONDS: '20',
      BCRYPT_ROUNDS: '12',
      CORS_ORIGINS: 'http://localhost:5173',
      SOCKET_TICKET_TTL_SECONDS: '30',
      SUPERUSER_NAME: 'Administrador',
      SUPERUSER_EMAIL: 'admin@helpdesk.local',
      SUPERUSER_PASSWORD: 'TroqueEstaSenha123',
      DEFAULT_RESET_PASSWORD: 'SenhaTeste123',
    });

    expect(env.dbSsl).toBe(false);
    expect(env.cookieSecure).toBe(false);
    expect(env.trustProxy).toBe(false);
  });
});
