import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { appConfig } from '../config/env';
import { Role, UserStatus } from '../domain/enums';
import type { User } from '../domain/models';
import { ConflictError, AuthError } from '../errors/app-error';
import { refreshTokenRepository, userRepository } from '../repositories';
import { hashToken, signAccessToken } from '../auth/session';
import type { UnitOfWorkContext } from '../repositories/unit-of-work';

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

export async function registerUser(input: { name: string; email: string; password: string }, context: UnitOfWorkContext = {}): Promise<AuthSessionPayload> {
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
    status: UserStatus.ACTIVE,
  }, { ...context, actorId: null });

  const refreshToken = await createRefreshSession(user.id, undefined, { ...context, actorId: user.id });
  return {
    user,
    accessToken: signAccessToken(user),
    refreshToken,
  };
}

export async function loginUser(input: { email: string; password: string }, context: UnitOfWorkContext = {}): Promise<AuthSessionPayload> {
  const user = await userRepository.findByEmail(input.email.toLowerCase());
  if (!user) throw new AuthError('INVALID_CREDENTIALS', 'Credenciais inválidas.');

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) throw new AuthError('INVALID_CREDENTIALS', 'Credenciais inválidas.');
  if (!user.isActive) throw new AuthError('ACCOUNT_DISABLED', 'Esta conta está desativada.');

  await userRepository.update(user.id, { lastLoginAt: new Date().toISOString().slice(0, 19).replace('T', ' ') }, { ...context, actorId: user.id });
  const refreshToken = await createRefreshSession(user.id, undefined, { ...context, actorId: user.id });
  return {
    user,
    accessToken: signAccessToken(user),
    refreshToken,
  };
}

export async function createRefreshSession(userId: number, familyId: string = crypto.randomUUID(), context: UnitOfWorkContext = {}): Promise<string> {
  const tokenValue = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(tokenValue);
  await refreshTokenRepository.create(
    userId,
    familyId,
    tokenHash,
    new Date(Date.now() + appConfig.refreshTtlDays * 24 * 60 * 60 * 1000),
    context,
  );
  return tokenValue;
}

export async function verifyRefreshToken(tokenValue: string): Promise<{ id: number; userId: number; familyId: string } | null> {
  const tokenHash = hashToken(tokenValue);
  const record = await refreshTokenRepository.findByHash(tokenHash);
  if (!record) return null;
  if (record.revokedAt || record.expiresAt.getTime() <= Date.now()) return null;
  return { id: record.id, userId: record.userId, familyId: record.familyId };
}

export async function refreshSession(tokenValue: string, context: UnitOfWorkContext = {}): Promise<AuthSessionPayload> {
  const session = await verifyRefreshToken(tokenValue);
  if (!session) {
    throw new AuthError('INVALID_REFRESH_TOKEN', 'Refresh token invalido.');
  }

  const user = await userRepository.findById(session.userId);
  if (!user || !user.isActive) {
    throw new AuthError('ACCOUNT_DISABLED', 'Conta desativada.');
  }

  await refreshTokenRepository.revoke(session.id, { ...context, actorId: user.id });
  const refreshToken = await createRefreshSession(user.id, session.familyId, { ...context, actorId: user.id });

  return {
    user,
    accessToken: signAccessToken(user),
    refreshToken,
  };
}

export async function revokeRefreshToken(tokenValue: string, context: UnitOfWorkContext = {}): Promise<void> {
  const tokenHash = hashToken(tokenValue);
  const record = await refreshTokenRepository.findByHash(tokenHash);
  if (record) await refreshTokenRepository.revoke(record.id, { ...context, actorId: record.userId });
}

export async function updateUser(userId: number, patch: Partial<User>, context: UnitOfWorkContext = {}): Promise<User | null> {
  return userRepository.update(userId, patch, context);
}
