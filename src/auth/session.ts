import crypto from 'node:crypto';
import type { Response } from 'express';
import * as jwt from 'jsonwebtoken';
import { appConfig } from '../config/env';
import { Role, TicketStatus, UserStatus } from '../domain/enums';
import type { Ticket, TicketComment, User } from '../domain/models';

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

export interface SectorRecord {
  id: number;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

const users = new Map<number, User>();
const refreshSessions = new Map<string, RefreshSessionRecord>();
const userByEmail = new Map<string, number>();
const sectors = new Map<number, SectorRecord>();
const tickets = new Map<number, Ticket>();
const comments = new Map<number, TicketComment>();
let nextUserId = 1;
let nextSectorId = 1;
let nextTicketId = 1;
let nextCommentId = 1;

export function sanitizeUser(user: User): PublicUser {
  const safeUser = { ...user } as Partial<User>;
  delete safeUser.passwordHash;
  return safeUser as PublicUser;
}

export function getUserById(userId: number): User | undefined {
  return users.get(userId);
}

export function listUsersByRole(role?: Role): User[] {
  return Array.from(users.values()).filter((user) => (role ? user.role === role : true));
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
  mustChangePassword?: boolean;
  sectorId?: number | null;
  isActive?: boolean;
}): User {
  const userId = nextUserId++;
  const now = new Date().toISOString();
  const user: User = {
    id: userId,
    name: input.name,
    email: input.email.toLowerCase(),
    passwordHash: input.passwordHash,
    role: input.role ?? Role.CLIENT,
    sectorId: input.sectorId ?? null,
    isActive: input.isActive ?? true,
    mustChangePassword: input.mustChangePassword ?? false,
    passwordChangedAt: null,
    lastLoginAt: null,
    createdAt: now,
    updatedAt: now,
    status: UserStatus.ACTIVE,
  };

  upsertUser(user);

  return user;
}

export function listActiveSectors(): SectorRecord[] {
  return Array.from(sectors.values()).filter((sector) => sector.isActive);
}

export function listAllSectors(): SectorRecord[] {
  return Array.from(sectors.values()).sort((a, b) => a.id - b.id);
}

export function createSectorRecord(name: string, isActive = true): SectorRecord {
  const sectorId = nextSectorId++;
  const now = new Date().toISOString();
  const sector: SectorRecord = {
    id: sectorId,
    name,
    isActive,
    createdAt: now,
    updatedAt: now,
  };

  sectors.set(sectorId, sector);
  return sector;
}

export function getSectorById(sectorId: number): SectorRecord | undefined {
  return sectors.get(sectorId);
}

export function updateSectorRecord(sectorId: number, patch: Partial<Pick<SectorRecord, 'name' | 'isActive'>>): SectorRecord | undefined {
  const sector = sectors.get(sectorId);
  if (!sector) {
    return undefined;
  }

  const updated = {
    ...sector,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  sectors.set(sectorId, updated);
  return updated;
}

export function createTicketRecord(input: {
  clientId: number;
  sectorId: number | null;
  title: string;
  description: string;
  technicianId?: number | null;
  status?: TicketStatus;
}): Ticket {
  const ticketId = nextTicketId++;
  const now = new Date().toISOString();
  const ticket: Ticket = {
    id: ticketId,
    clientId: input.clientId,
    technicianId: input.technicianId ?? null,
    sectorId: input.sectorId ?? null,
    title: input.title.trim(),
    description: input.description.trim(),
    status: input.status ?? TicketStatus.OPEN,
    resolutionNote: null,
    createdAt: now,
    updatedAt: now,
    assumedAt: null,
    resolvedAt: null,
    cancelledAt: null,
  };

  tickets.set(ticketId, ticket);
  return ticket;
}

export function getTicketById(ticketId: number): Ticket | undefined {
  return tickets.get(ticketId);
}

export function listTicketsByClient(clientId: number): Ticket[] {
  return Array.from(tickets.values())
    .filter((ticket) => ticket.clientId === clientId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function listTicketsByTechnician(technicianId: number): Ticket[] {
  return Array.from(tickets.values())
    .filter((ticket) => ticket.technicianId === technicianId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function listOpenTickets(): Ticket[] {
  return Array.from(tickets.values())
    .filter((ticket) => ticket.status === TicketStatus.OPEN)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function countTicketsByClient(clientId: number): Record<string, number> {
  const counts: Record<string, number> = {
    OPEN: 0,
    IN_PROGRESS: 0,
    RESOLVED: 0,
    CANCELLED: 0,
  };

  for (const ticket of listTicketsByClient(clientId)) {
    counts[ticket.status] = (counts[ticket.status] ?? 0) + 1;
  }

  return counts;
}

export function updateTicketRecord(ticketId: number, patch: Partial<Ticket>): Ticket | undefined {
  const ticket = tickets.get(ticketId);

  if (!ticket) {
    return undefined;
  }

  const updated: Ticket = {
    ...ticket,
    ...patch,
    updatedAt: new Date().toISOString(),
  };

  tickets.set(ticketId, updated);
  return updated;
}

export function createCommentRecord(input: {
  ticketId: number;
  authorId: number;
  parentId?: number | null;
  body: string;
}): TicketComment {
  const commentId = nextCommentId++;
  const now = new Date().toISOString();
  const comment: TicketComment = {
    id: commentId,
    ticketId: input.ticketId,
    authorId: input.authorId,
    parentId: input.parentId ?? null,
    body: input.body.trim(),
    editedAt: null,
    deletedAt: null,
    createdAt: now,
  };

  comments.set(commentId, comment);
  return comment;
}

export function getCommentById(commentId: number): TicketComment | undefined {
  return comments.get(commentId);
}

export function listCommentsByTicket(ticketId: number): TicketComment[] {
  return Array.from(comments.values())
    .filter((comment) => comment.ticketId === ticketId && comment.deletedAt === null)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function updateCommentRecord(commentId: number, patch: Partial<TicketComment>): TicketComment | undefined {
  const comment = comments.get(commentId);

  if (!comment) {
    return undefined;
  }

  const updated: TicketComment = {
    ...comment,
    ...patch,
  };

  comments.set(commentId, updated);
  return updated;
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
