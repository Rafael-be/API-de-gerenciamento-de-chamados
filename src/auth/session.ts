import crypto from 'node:crypto';
import type { Response } from 'express';
import * as jwt from 'jsonwebtoken';
import { appConfig } from '../config/env';
import { Role } from '../domain/enums';
import type { User } from '../domain/models';

export type PublicUser = Omit<User, 'passwordHash'>;

export function sanitizeUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    sectorId: user.sectorId,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    passwordChangedAt: user.passwordChangedAt,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    status: user.status,
  };
}

export function hashToken(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export function signAccessToken(user: Pick<User, 'id' | 'role'>): string {
  return jwt.sign(
    { role: user.role },
    appConfig.jwtAccessSecret,
    { subject: String(user.id), expiresIn: appConfig.jwtAccessTtl as jwt.SignOptions['expiresIn'], issuer: 'helpdesk-api' },
  );
}

export function verifyAccessToken(token: string): { sub: string; role: Role } {
  const payload = jwt.verify(token, appConfig.jwtAccessSecret, { issuer: 'helpdesk-api' });
  if (typeof payload === 'string' || !payload.sub || !payload.role) {
    throw new Error('INVALID_ACCESS_TOKEN');
  }
  return { sub: payload.sub, role: payload.role as Role };
}

export function setSessionCookies(res: Response, accessToken: string, refreshToken: string): void {
  const accessMaxAge = parseTtlMilliseconds(appConfig.jwtAccessTtl);
  const refreshMaxAge = appConfig.refreshTtlDays * 24 * 60 * 60 * 1000;
  const cookieOptions = {
    httpOnly: true,
    secure: appConfig.cookieSecure,
    sameSite: 'lax' as const,
    path: '/',
  };

  res.cookie('access_token', accessToken, { ...cookieOptions, maxAge: accessMaxAge });
  res.cookie('refresh_token', refreshToken, { ...cookieOptions, path: '/api/v1/auth', maxAge: refreshMaxAge });
}

export function clearSessionCookies(res: Response): void {
  const cookieOptions = {
    httpOnly: true,
    secure: appConfig.cookieSecure,
    sameSite: 'lax' as const,
    path: '/',
  };
  res.clearCookie('access_token', cookieOptions);
  res.clearCookie('refresh_token', { ...cookieOptions, path: '/api/v1/auth' });
}

function parseTtlMilliseconds(ttl: string): number {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) {
    return 15 * 60 * 1000;
  }
  const value = Number(match[1]);
  const unit = match[2];
  const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return value * multipliers[unit as keyof typeof multipliers];
}
