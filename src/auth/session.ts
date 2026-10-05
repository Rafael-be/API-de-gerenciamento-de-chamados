import crypto from 'node:crypto';
import type { Response } from 'express';
import * as jwt from 'jsonwebtoken';
import { appConfig } from '../config/env';
import { Role, UserStatus } from '../domain/enums';
import type { User } from '../domain/models';

export type PublicUser = Omit<User, 'passwordHash'>;

export interface RefreshSessionRecord {
  userId: number;
  familyId: string;
  tokenHash: string;
  expiresAt: number;
  createdAt: number;
  rotatedAt: number | null;
  revokedAt: number | null;
}

const users = new Map<number, User>();
const refreshSessions = new Map<string, RefreshSessionRecord>();
const userByEmail = new Map<string, number>();
let nextUserId = 1;

export function sanitizeUser(user: User): PublicUser {
  const safeUser = { ...user } as Partial<User>;
  delete safeUser.passwordHash;
  return safeUser as PublicUser;
}

export function getUserById(userId: number): User | undefined {
  return users.get(userId);
}

export function getUserByEmail(email: string): User | undefined {
  const userId = userByEmail.get(email.toLowerCase());
  if (userId === undefined) {
    return undefined;
  }

  return users.get(userId);
}

export function upsertUser(user: User): User {
  users.set(user.id, user);
  userByEmail.set(user.email.toLowerCase(), user.id);
  return user;
}

export function createUserRecord(input: {
  name: string;
  email: string;
  passwordHash: string;
  role?: Role;
}): User {
  const userId = nextUserId++;
  const now = new Date().toISOString();
  const user: User = {
    id: userId,
    name: input.name,
    email: input.email.toLowerCase(),
    passwordHash: input.passwordHash,
    role: input.role ?? Role.CLIENT,
    sectorId: null,
    isActive: true,
    mustChangePassword: false,
    passwordChangedAt: null,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
    status: UserStatus.ACTIVE,
  };

  upsertUser(user);

  return user;
}

export function hashToken(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function createRefreshToken(userId: number, familyId?: string): { familyId: string; tokenValue: string; tokenHash: string; expiresAt: number; } {
  const resolvedFamilyId = familyId ?? crypto.randomUUID();
  const tokenValue = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(tokenValue);
  const expiresAt = Date.now() + appConfig.refreshTtlDays * 24 * 60 * 60 * 1000;

  refreshSessions.set(tokenHash, {
    userId,
    familyId: resolvedFamilyId,
    tokenHash,
    expiresAt,
    createdAt: Date.now(),
    rotatedAt: null,
    revokedAt: null,
  });

  return {
    familyId: resolvedFamilyId,
    tokenValue,
    tokenHash,
    expiresAt,
  };
}

export function rotateRefreshToken(oldTokenValue: string): { tokenValue: string; tokenHash: string; familyId: string; expiresAt: number; } | null {
  const oldTokenHash = hashToken(oldTokenValue);
  const record = refreshSessions.get(oldTokenHash);

  if (!record) {
    return null;
  }

  if (record.revokedAt !== null) {
    return null;
  }

  record.revokedAt = Date.now();
  record.rotatedAt = Date.now();

  const rotated = createRefreshToken(record.userId, record.familyId);
  return rotated;
}

export function revokeRefreshToken(tokenValue: string): void {
  const tokenHash = hashToken(tokenValue);
  const record = refreshSessions.get(tokenHash);

  if (!record) {
    return;
  }

  record.revokedAt = Date.now();
  refreshSessions.delete(tokenHash);
}

export function findRefreshSessionByToken(tokenValue: string): RefreshSessionRecord | undefined {
  const tokenHash = hashToken(tokenValue);
  const record = refreshSessions.get(tokenHash);

  if (!record) {
    return undefined;
  }

  return record;
}

export function signAccessToken(user: Pick<User, 'id' | 'role'>): string {
  return jwt.sign(
    { sub: String(user.id), role: user.role },
    appConfig.jwtAccessSecret as jwt.Secret,
    {
      expiresIn: appConfig.jwtAccessTtl,
      issuer: 'helpdesk-api',
    } as jwt.SignOptions,
  );
}

export function verifyAccessToken(token: string): { sub: string; role: Role } {
  const payload = jwt.verify(token, appConfig.jwtAccessSecret as jwt.Secret, { issuer: 'helpdesk-api' } as jwt.VerifyOptions) as {
    sub?: string;
    role?: Role;
  };

  if (typeof payload.sub !== 'string' || typeof payload.role !== 'string') {
    throw new Error('INVALID_TOKEN_PAYLOAD');
  }

  return {
    sub: payload.sub,
    role: payload.role as Role,
  };
}

export function setSessionCookies(res: Response, accessToken: string, refreshToken: string): void {
  const accessMaxAge = parseTtlToMs(appConfig.jwtAccessTtl);
  const refreshMaxAge = appConfig.refreshTtlDays * 24 * 60 * 60 * 1000;

  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: appConfig.cookieSecure,
    sameSite: 'lax',
    path: '/',
    maxAge: accessMaxAge,
  });

  res.cookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: appConfig.cookieSecure,
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: refreshMaxAge,
  });
}

export function clearSessionCookies(res: Response): void {
  res.clearCookie('access_token', { httpOnly: true, sameSite: 'lax', secure: appConfig.cookieSecure, path: '/' });
  res.clearCookie('refresh_token', { httpOnly: true, sameSite: 'lax', secure: appConfig.cookieSecure, path: '/api/v1/auth' });
}

function parseTtlToMs(value: string): number {
  const match = /^([0-9]+)([smhd])$/.exec(value.trim().toLowerCase());

  if (!match) {
    return 15 * 60 * 1000;
  }

  const amount = Number(match[1]);
  const unit = match[2];

  switch (unit) {
    case 's':
      return amount * 1000;
    case 'm':
      return amount * 60 * 1000;
    case 'h':
      return amount * 60 * 60 * 1000;
    case 'd':
      return amount * 24 * 60 * 60 * 1000;
    default:
      return 15 * 60 * 1000;
  }
}
