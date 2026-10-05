import {
  getCommentById,
  getSectorById,
  getTicketById,
  getUnreadNotificationCount,
  getUserByEmail,
  getUserById,
  listActiveSectors,
  listAllSectors,
  listCommentsByTicket,
  listNotificationsForUser,
  listOpenTickets,
  listTicketsByClient,
  markAllNotificationsReadForUser,
  markNotificationRead,
  upsertComment,
  upsertNotification,
  upsertSector,
  upsertTicket,
  upsertUser,
} from '../../auth/session';
import { NotificationType, Role, TicketStatus, UserStatus } from '../../domain/enums';
import type { Notification, Sector, Ticket, TicketComment, User } from '../../domain/models';

const users = new Map<number, User>();
const sectors = new Map<number, Sector>();
const tickets = new Map<number, Ticket>();
const comments = new Map<number, TicketComment>();
const notifications = new Map<number, Notification>();
const refreshTokens = new Map<string, { id: number; userId: number; familyId: string; tokenHash: string; expiresAt: Date; revokedAt: Date | null; rotatedAt: Date | null; createdAt: Date; }>();

let nextUserId = 1000;
let nextSectorId = 2000;
let nextTicketId = 3000;
let nextCommentId = 4000;
let nextNotificationId = 5000;
let nextRefreshTokenId = 6000;

function nextNumericId(kind: 'user' | 'sector' | 'ticket' | 'comment' | 'notification'): number {
  const nextValue = (() => {
    switch (kind) {
      case 'user':
        return nextUserId++;
      case 'sector':
        return nextSectorId++;
      case 'ticket':
        return nextTicketId++;
      case 'comment':
        return nextCommentId++;
      case 'notification':
        return nextNotificationId++;
      default:
        return nextUserId++;
    }
  })();

  return nextValue;
}

export const userRepository = {
  async findById(id: number): Promise<User | null> {
    return getUserById(id) ?? users.get(id) ?? null;
  },

  async findByEmail(email: string): Promise<User | null> {
    const normalized = email.toLowerCase();
    return getUserByEmail(normalized) ?? Array.from(users.values()).find((user) => user.email.toLowerCase() === normalized) ?? null;
  },

  async listByRole(role: Role): Promise<User[]> {
    return Array.from(users.values()).filter((user) => user.role === role);
  },

  async create(input: Partial<User> & { email: string; passwordHash: string; role: Role }): Promise<User> {
    const user: User = {
      id: nextNumericId('user'),
      name: input.name ?? 'Usuário',
      email: input.email.toLowerCase(),
      passwordHash: input.passwordHash,
      role: input.role,
      sectorId: input.sectorId ?? null,
      isActive: input.isActive ?? true,
      mustChangePassword: input.mustChangePassword ?? false,
      passwordChangedAt: input.passwordChangedAt ?? null,
      lastLoginAt: input.lastLoginAt ?? null,
      createdAt: input.createdAt ?? new Date().toISOString(),
      updatedAt: input.updatedAt ?? new Date().toISOString(),
      status: input.status ?? (input.isActive === false ? UserStatus.INACTIVE : UserStatus.ACTIVE),
    };
    users.set(user.id, user);
    upsertUser(user);
    return user;
  },

  async update(id: number, patch: Partial<User>): Promise<User | null> {
    const existing = users.get(id);
    if (!existing) return null;
    const updated: User = {
      ...existing,
      ...patch,
      email: patch.email?.toLowerCase() ?? existing.email,
      updatedAt: new Date().toISOString(),
      status: patch.status ?? existing.status,
      isActive: patch.isActive ?? existing.isActive,
    };
    users.set(id, updated);
    upsertUser(updated);
    return updated;
  },
};

export const sectorRepository = {
  async findById(id: number): Promise<Sector | null> {
    return getSectorById(id) ?? sectors.get(id) ?? null;
  },

  async findActive(): Promise<Sector[]> {
    return listActiveSectors().length ? listActiveSectors() : Array.from(sectors.values()).filter((sector) => sector.isActive);
  },

  async findAll(): Promise<Sector[]> {
    return listAllSectors().length ? listAllSectors() : Array.from(sectors.values()).sort((a, b) => a.id - b.id);
  },

  async create(name: string, isActive = true): Promise<Sector> {
    const sector: Sector = {
      id: nextNumericId('sector'),
      name,
      isActive,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    sectors.set(sector.id, sector);
    upsertSector({ ...sector, createdAt: sector.createdAt, updatedAt: sector.updatedAt });
    return sector;
  },

  async update(id: number, patch: Partial<Sector>): Promise<Sector | null> {
    const existing = sectors.get(id);
    if (!existing) return null;
    const updated: Sector = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    sectors.set(id, updated);
    upsertSector({ ...updated, createdAt: updated.createdAt, updatedAt: updated.updatedAt });
    return updated;
  },
};

export const ticketRepository = {
  async findById(id: number): Promise<Ticket | null> {
    return getTicketById(id) ?? tickets.get(id) ?? null;
  },

  async findByClient(clientId: number): Promise<Ticket[]> {
    const sessionTickets = listTicketsByClient(clientId);
    return sessionTickets.length ? sessionTickets : Array.from(tickets.values())
      .filter((ticket) => ticket.clientId === clientId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async findOpen(): Promise<Ticket[]> {
    const sessionTickets = listOpenTickets();
    return sessionTickets.length ? sessionTickets : Array.from(tickets.values())
      .filter((ticket) => ticket.status === TicketStatus.OPEN)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async create(input: Omit<Ticket, 'id' | 'createdAt' | 'updatedAt'>): Promise<Ticket> {
    const ticket: Ticket = {
      id: nextNumericId('ticket'),
      ...input,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    tickets.set(ticket.id, ticket);
    upsertTicket(ticket);
    return ticket;
  },

  async update(id: number, patch: Partial<Ticket>): Promise<Ticket | null> {
    const existing = tickets.get(id);
    if (!existing) return null;
    const updated: Ticket = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    tickets.set(id, updated);
    upsertTicket(updated);
    return updated;
  },
};

export const commentRepository = {
  async findById(id: number): Promise<TicketComment | null> {
    return getCommentById(id) ?? comments.get(id) ?? null;
  },

  async findByTicket(ticketId: number): Promise<TicketComment[]> {
    const sessionComments = listCommentsByTicket(ticketId);
    return sessionComments.length ? sessionComments : Array.from(comments.values())
      .filter((comment) => comment.ticketId === ticketId && comment.deletedAt === null)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  },

  async create(input: Partial<TicketComment> & { ticketId: number; authorId: number; body: string }): Promise<TicketComment> {
    const comment: TicketComment = {
      id: nextNumericId('comment'),
      ticketId: input.ticketId,
      authorId: input.authorId,
      parentId: input.parentId ?? null,
      body: input.body,
      editedAt: null,
      deletedAt: null,
      createdAt: new Date().toISOString(),
    };
    comments.set(comment.id, comment);
    upsertComment(comment);
    return comment;
  },

  async update(id: number, patch: Partial<TicketComment>): Promise<TicketComment | null> {
    const existing = comments.get(id);
    if (!existing) return null;
    const updated: TicketComment = { ...existing, ...patch };
    comments.set(id, updated);
    upsertComment(updated);
    return updated;
  },

  async delete(id: number): Promise<TicketComment | null> {
    const existing = comments.get(id);
    if (!existing) return null;
    const updated: TicketComment = { ...existing, deletedAt: new Date().toISOString() };
    comments.set(id, updated);
    upsertComment(updated);
    return updated;
  },
};

export const notificationRepository = {
  async findByUser(userId: number): Promise<Notification[]> {
    const sessionNotifications = listNotificationsForUser(userId);
    return sessionNotifications.length ? sessionNotifications : Array.from(notifications.values())
      .filter((notification) => notification.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async countUnread(userId: number): Promise<number> {
    const sessionUnread = getUnreadNotificationCount(userId);
    return sessionUnread > 0 ? sessionUnread : Array.from(notifications.values()).filter((notification) => notification.userId === userId && !notification.isRead).length;
  },

  async create(input: Partial<Notification> & { userId: number; type: NotificationType; message: string }): Promise<Notification> {
    const notification: Notification = {
      id: nextNumericId('notification'),
      userId: input.userId,
      type: input.type,
      ticketId: input.ticketId ?? null,
      commentId: input.commentId ?? null,
      actorId: input.actorId ?? null,
      message: input.message,
      isRead: Boolean(input.isRead),
      readAt: input.readAt ?? null,
      createdAt: input.createdAt ?? new Date().toISOString(),
    };
    notifications.set(notification.id, notification);
    upsertNotification(notification);
    return notification;
  },

  async findById(id: number): Promise<Notification | null> {
    const sessionItem = listNotificationsForUser(Number.MAX_SAFE_INTEGER).find((notification) => notification.id === id);
    return sessionItem ?? notifications.get(id) ?? null;
  },

  async markRead(id: number, userId: number): Promise<Notification | null> {
    const existing = notifications.get(id) ?? listNotificationsForUser(userId).find((notification) => notification.id === id) ?? null;
    if (!existing || existing.userId !== userId) return null;
    const updated: Notification = { ...existing, isRead: true, readAt: new Date().toISOString() };
    notifications.set(id, updated);
    upsertNotification(updated);
    markNotificationRead(id, userId);
    return updated;
  },

  async markAllRead(userId: number): Promise<number> {
    const sessionCount = markAllNotificationsReadForUser(userId);
    let count = 0;
    for (const [id, notification] of notifications.entries()) {
      if (notification.userId === userId && !notification.isRead) {
        const updated = { ...notification, isRead: true, readAt: new Date().toISOString() };
        notifications.set(id, updated);
        upsertNotification(updated);
        count += 1;
      }
    }
    return count + sessionCount;
  },
};

export const refreshTokenRepository = {
  async create(userId: number, familyId: string, tokenHash: string, expiresAt: Date): Promise<{ id: number }> {
    const record = {
      id: nextRefreshTokenId++,
      userId,
      familyId,
      tokenHash,
      expiresAt,
      revokedAt: null,
      rotatedAt: null,
      createdAt: new Date(),
    };
    refreshTokens.set(tokenHash, record);
    return { id: record.id };
  },

  async findByHash(tokenHash: string): Promise<{ id: number; userId: number; familyId: string; tokenHash: string; expiresAt: Date; revokedAt: Date | null; rotatedAt: Date | null } | null> {
    const record = refreshTokens.get(tokenHash);
    if (!record) return null;
    return { ...record };
  },

  async revoke(id: number): Promise<void> {
    for (const record of refreshTokens.values()) {
      if (record.id === id) {
        record.revokedAt = new Date();
      }
    }
  },
};

export const auditLogRepository = {
  async create(input: { actorId?: number | null; action: string; entityType: string; entityId?: number | null; metadata?: Record<string, unknown> | null; requestId?: string | null; ip?: string | null; userAgent?: string | null }): Promise<void> {
    void input;
  },
};
