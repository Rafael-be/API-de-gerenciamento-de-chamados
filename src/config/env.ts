import * as dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const booleanFromEnv = z.preprocess(
  (value) => {
    if (value === undefined) {
      return false;
    }

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      return value.toLowerCase() === 'true';
    }

    return false;
  },
  z.boolean(),
);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DB_HOST: z.string().min(1).default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().positive().default(3306),
  DB_USER: z.string().min(1).default('helpdesk_user'),
  DB_PASSWORD: z.string().min(1).default('dev-db-password'),
  DB_NAME: z.string().min(1).default('helpdesk'),
  DB_POOL_LIMIT: z.coerce.number().int().positive().default(10),
  DB_SSL: booleanFromEnv.default(false),
  DB_SSL_CA: z.string().optional().default(''),
  TEST_DB_HOST: z.string().optional().default('127.0.0.1'),
  TEST_DB_PORT: z.coerce.number().int().positive().optional().default(3307),
  TEST_DB_USER: z.string().optional().default('root'),
  TEST_DB_PASSWORD: z.string().optional().default(''),
  TEST_DB_NAME: z.string().optional().default('helpdesk_test'),
  JWT_ACCESS_SECRET: z.string().min(16).default('dev-access-secret-change-me'),
  JWT_ACCESS_TTL: z.string().min(1).default('15m'),
  REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
  REFRESH_GRACE_SECONDS: z.coerce.number().int().nonnegative().default(20),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).default(12),
  COOKIE_SECURE: booleanFromEnv.default(false),
  CORS_ORIGINS: z.string().min(1).default('http://localhost:5173'),
  TRUST_PROXY: booleanFromEnv.default(false),
  SOCKET_TICKET_TTL_SECONDS: z.coerce.number().int().positive().default(30),
  SUPERUSER_NAME: z.string().min(1).default('Administrador'),
  SUPERUSER_EMAIL: z.string().email().default('admin@helpdesk.local'),
  SUPERUSER_PASSWORD: z.string().min(8).default('DevSuperuserPassword123'),
  DEFAULT_RESET_PASSWORD: z.string().min(8).default('DevResetPassword123'),
});

export type AppConfig = {
  nodeEnv: string;
  port: number;
  logLevel: string;
  dbHost: string;
  dbPort: number;
  dbUser: string;
  dbPassword: string;
  dbName: string;
  dbPoolLimit: number;
  dbSsl: boolean;
  dbSslCa: string;
  testDbHost: string;
  testDbPort: number;
  testDbUser: string;
  testDbPassword: string;
  testDbName: string;
  jwtAccessSecret: string;
  jwtAccessTtl: string;
  refreshTtlDays: number;
  refreshGraceSeconds: number;
  bcryptRounds: number;
  cookieSecure: boolean;
  corsOrigins: string[];
  trustProxy: boolean;
  socketTicketTtlSeconds: number;
  superuserName: string;
  superuserEmail: string;
  superuserPassword: string;
  defaultResetPassword: string;
};

export function loadEnv(env: Record<string, string | undefined> = process.env): AppConfig {
  const parsed = envSchema.parse(env);

  if (parsed.NODE_ENV === 'production') {
    const requiredProductionKeys = ['DB_PASSWORD', 'JWT_ACCESS_SECRET', 'SUPERUSER_PASSWORD', 'DEFAULT_RESET_PASSWORD'] as const;
    const missingKeys = requiredProductionKeys.filter((key) => !env[key] || env[key]!.trim() === '');

    if (missingKeys.length > 0) {
      throw new Error(
        `Production environment requires explicit values for: ${missingKeys.join(', ')}.`,
      );
    }
  }

  return {
    nodeEnv: parsed.NODE_ENV,
    port: parsed.PORT,
    logLevel: parsed.LOG_LEVEL,
    dbHost: parsed.DB_HOST,
    dbPort: parsed.DB_PORT,
    dbUser: parsed.DB_USER,
    dbPassword: parsed.DB_PASSWORD,
    dbName: parsed.DB_NAME,
    dbPoolLimit: parsed.DB_POOL_LIMIT,
    dbSsl: parsed.DB_SSL,
    dbSslCa: parsed.DB_SSL_CA,
    testDbHost: parsed.TEST_DB_HOST,
    testDbPort: parsed.TEST_DB_PORT,
    testDbUser: parsed.TEST_DB_USER,
    testDbPassword: parsed.TEST_DB_PASSWORD,
    testDbName: parsed.TEST_DB_NAME,
    jwtAccessSecret: parsed.JWT_ACCESS_SECRET,
    jwtAccessTtl: parsed.JWT_ACCESS_TTL,
    refreshTtlDays: parsed.REFRESH_TTL_DAYS,
    refreshGraceSeconds: parsed.REFRESH_GRACE_SECONDS,
    bcryptRounds: parsed.BCRYPT_ROUNDS,
    cookieSecure: parsed.COOKIE_SECURE,
    corsOrigins: parsed.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
    trustProxy: parsed.TRUST_PROXY,
    socketTicketTtlSeconds: parsed.SOCKET_TICKET_TTL_SECONDS,
    superuserName: parsed.SUPERUSER_NAME,
    superuserEmail: parsed.SUPERUSER_EMAIL,
    superuserPassword: parsed.SUPERUSER_PASSWORD,
    defaultResetPassword: parsed.DEFAULT_RESET_PASSWORD,
  };
}

export const appConfig = loadEnv();
