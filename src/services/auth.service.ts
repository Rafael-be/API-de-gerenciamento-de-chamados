import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { appConfig } from '../config/env';
import { Role } from '../domain/enums';
import type { User } from '../domain/models';
import { ConflictError, AuthError } from '../errors/app-error';
import { refreshTokenRepository, userRepository } from '../repositories';
import { createRefreshToken, hashToken, signAccessToken } from '../auth/session';

export interface AuthSessionPayload {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export async function findUserByEmail(email: string): Promise<User | null> {
  return userRepository.findByEmail(email);
}

export async function findUserById(id: number): Promise<User | null> {
  return userRepository.findById(id);
}

export async function registerUser(input: { name: string; email: string; password: string }): Promise<AuthSessionPayload> {
  const existing = await findUserByEmail(input.email);
  if (existing) throw new ConflictError('EMAIL_ALREADY_REGISTERED', 'Este e-mail já está em uso.');

  const passwordHash = await bcrypt.hash(input.password, appConfig.bcryptRounds);
  const user = await userRepository.create({
    name: input.name,
    email: input.email.toLowerCase(),
    passwordHash,
    role: Role.CLIENT,
    sectorId: null,
    isActive: true,
    mustChangePassword: false,
    passwordChangedAt: null,
    lastLoginAt: null,
    status: 'ACTIVE' as any,
  });

  const refreshToken = await createRefreshSession(user.id);
  return {
    user,
    accessToken: signAccessToken(user),
    refreshToken,
  };
}

export async function loginUser(input: { email: string; password: string }): Promise<AuthSessionPayload> {
  const user = await userRepository.findByEmail(input.email.toLowerCase());
  if (!user) throw new AuthError('INVALID_CREDENTIALS', 'Credenciais inválidas.');

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) throw new AuthError('INVALID_CREDENTIALS', 'Credenciais inválidas.');
  if (!user.isActive) throw new AuthError('ACCOUNT_DISABLED', 'Esta conta está desativada.');

  const refreshToken = await createRefreshSession(user.id);
  return {
    user,
    accessToken: signAccessToken(user),
    refreshToken,
  };
}

export async function createRefreshSession(userId: number): Promise<string> {
  const { tokenValue } = createRefreshToken(userId);
  await refreshTokenRepository.create(userId, tokenValue, hashToken(tokenValue), new Date(Date.now() + appConfig.refreshTtlDays * 24 * 60 * 60 * 1000));
  return tokenValue;
}

export async function verifyRefreshToken(tokenValue: string): Promise<{ userId: number; familyId: string } | null> {
  const tokenHash = hashToken(tokenValue);
  const record = await refreshTokenRepository.findByHash(tokenHash);
  if (!record) return null;
  if (record.revokedAt || record.expiresAt.getTime() <= Date.now()) return null;
  return { userId: record.userId, familyId: record.familyId };
}

export async function revokeRefreshToken(tokenValue: string): Promise<void> {
  const tokenHash = hashToken(tokenValue);
  const record = await refreshTokenRepository.findByHash(tokenHash);
  if (record) await refreshTokenRepository.revoke(record.id);
}

export async function updateUser(userId: number, patch: Partial<User>): Promise<User | null> {
  return userRepository.update(userId, patch);
}
