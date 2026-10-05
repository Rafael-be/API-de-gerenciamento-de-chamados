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
} from './test-state';
import { NotificationType, Role, TicketStatus, UserStatus } from '../../domain/enums';
import type { Notification, Sector, Ticket, TicketComment, User } from '../../domain/models';

const users = new Map<number, User>();
const sectors = new Map<number, Sector>();
const tickets = new Map<number, Ticket>();
const comments = new Map<number, TicketComment>();
const notifications = new Map<number, Notification>();
const refreshTokens = new Map<string, { id: number; userId: number; familyId: string; tokenHash: string; expiresAt: Date; revokedAt: Date | null; rotatedAt: Date | null; createdAt: Date; }>();
const socketTickets = new Map<string, { userId: number; expiresAt: Date; consumed: boolean }>();

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

  async create(input: Omit<Partial<User>, 'name'> & { name: string; email: string; passwordHash: string; role: Role }, _context?: { actorId?: number | null; requestId?: string | null }): Promise<User> {
    const user: User = {
      id: nextNumericId('user'),
      name: input.name,
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

  async update(id: number, patch: Partial<User>, _context?: { actorId?: number | null; requestId?: string | null }): Promise<User | null> {
    const existing = users.get(id) ?? getUserById(id);
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

  async deactivateTechnician(
    id: number,
    _context: { actorId?: number | null; requestId?: string | null } = {},
  ): Promise<void> {
    const user = await this.findById(id);
    if (!user) throw new Error('USER_NOT_FOUND');
    await this.update(id, { isActive: false, status: UserStatus.INACTIVE });
    for (const ticket of tickets.values()) {
      if (ticket.technicianId === id && ticket.status === TicketStatus.IN_PROGRESS) {
        await ticketRepository.update(ticket.id, { technicianId: null, status: TicketStatus.OPEN, assumedAt: null });
      }
    }
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

  async create(name: string, isActive = true, _context?: { actorId?: number | null; requestId?: string | null }): Promise<Sector> {
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

  async update(id: number, patch: Partial<Sector>, _context?: { actorId?: number | null; requestId?: string | null }): Promise<Sector | null> {
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

  async findByTechnician(technicianId: number): Promise<Ticket[]> {
    return Array.from(tickets.values())
      .filter((ticket) => ticket.technicianId === technicianId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },

  async create(input: Omit<Ticket, 'id' | 'createdAt' | 'updatedAt'>, _context?: { actorId?: number | null; requestId?: string | null }): Promise<Ticket> {
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

  async update(id: number, patch: Partial<Ticket>, _context?: { actorId?: number | null; requestId?: string | null }): Promise<Ticket | null> {
    const existing = tickets.get(id);
    if (!existing) return null;
    const updated: Ticket = { ...existing, ...patch, updatedAt: new Date().toISOString() };
    tickets.set(id, updated);
    upsertTicket(updated);
    return updated;
  },

  async runLifecycleProcedure(
    procedure: 'sp_assume_ticket' | 'sp_return_ticket' | 'sp_finish_ticket' | 'sp_cancel_ticket',
    parameters: Array<number | string | null>,
    _context?: { actorId?: number | null; requestId?: string | null },
  ): Promise<void> {
    const ticketId = Number(parameters[0]);
    const actorId = Number(parameters[1]);
    const ticket = await this.findById(ticketId);
    if (!ticket) throw new Error('TICKET_NOT_FOUND');

    if (procedure === 'sp_assume_ticket') {
      if (ticket.status !== TicketStatus.OPEN) throw new Error('TICKET_INVALID_TRANSITION');
      await this.update(ticketId, { technicianId: actorId, status: TicketStatus.IN_PROGRESS, assumedAt: new Date().toISOString() });
    } else if (procedure === 'sp_return_ticket') {
      if (ticket.technicianId !== actorId) throw new Error('NOT_ASSIGNED_TECHNICIAN');
      if (ticket.status !== TicketStatus.IN_PROGRESS) throw new Error('TICKET_INVALID_TRANSITION');
      await this.update(ticketId, { technicianId: null, status: TicketStatus.OPEN, assumedAt: null });
    } else if (procedure === 'sp_finish_ticket') {
      if (ticket.technicianId !== actorId) throw new Error('NOT_ASSIGNED_TECHNICIAN');
      if (ticket.status !== TicketStatus.IN_PROGRESS) throw new Error('TICKET_ALREADY_RESOLVED');
      await this.update(ticketId, { status: TicketStatus.RESOLVED, resolutionNote: String(parameters[2] ?? '') || null, resolvedAt: new Date().toISOString() });
    } else {
      if (ticket.clientId !== actorId) throw new Error('NOT_TICKET_OWNER');
      if (ticket.status !== TicketStatus.OPEN && ticket.status !== TicketStatus.IN_PROGRESS) throw new Error('TICKET_INVALID_TRANSITION');
      await this.update(ticketId, {
        status: TicketStatus.CANCELLED,
        cancelledAt: new Date().toISOString(),
        technicianId: ticket.status === TicketStatus.IN_PROGRESS ? null : ticket.technicianId,
      });
    }
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

  async create(input: Partial<TicketComment> & { ticketId: number; authorId: number; body: string }, _context?: { actorId?: number | null; requestId?: string | null }): Promise<TicketComment> {
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

  async update(id: number, patch: Partial<TicketComment>, _context?: { actorId?: number | null; requestId?: string | null }): Promise<TicketComment | null> {
    const existing = comments.get(id);
    if (!existing) return null;
    const updated: TicketComment = { ...existing, ...patch };
    comments.set(id, updated);
    upsertComment(updated);
    return updated;
  },

  async delete(id: number, _context?: { actorId?: number | null; requestId?: string | null }): Promise<TicketComment | null> {
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

  async create(input: Partial<Notification> & { userId: number; type: NotificationType; message: string }, _context?: { actorId?: number | null; requestId?: string | null }): Promise<Notification> {
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

  async markRead(id: number, userId: number, _context?: { actorId?: number | null; requestId?: string | null }): Promise<Notification | null> {
    const existing = notifications.get(id) ?? listNotificationsForUser(userId).find((notification) => notification.id === id) ?? null;
    if (!existing || existing.userId !== userId) return null;
    const updated: Notification = { ...existing, isRead: true, readAt: new Date().toISOString() };
    notifications.set(id, updated);
    upsertNotification(updated);
    markNotificationRead(id, userId);
    return updated;
  },

  async markAllRead(userId: number, _context?: { actorId?: number | null; requestId?: string | null }): Promise<number> {
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
  async create(userId: number, familyId: string, tokenHash: string, expiresAt: Date, _context?: { actorId?: number | null; requestId?: string | null }): Promise<{ id: number }> {
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

  async revoke(id: number, _context?: { actorId?: number | null; requestId?: string | null }): Promise<void> {
    for (const record of refreshTokens.values()) {
      if (record.id === id) {
        record.revokedAt = new Date();
      }
    }
  },
};

export const socketTicketRepository = {
  async create(
    userId: number,
    ticketHash: string,
    expiresAt: Date,
    _context?: { actorId?: number | null; requestId?: string | null },
  ): Promise<void> {
    socketTickets.set(ticketHash, { userId, expiresAt, consumed: false });
  },

  async consume(ticketHash: string): Promise<number | null> {
    const record = socketTickets.get(ticketHash);
    if (!record || record.consumed || record.expiresAt.getTime() <= Date.now()) return null;
    record.consumed = true;
    return record.userId;
  },
};

export const auditLogRepository = {
  async create(input: { actorId?: number | null; action: string; entityType: string; entityId?: number | null; metadata?: Record<string, unknown> | null; requestId?: string | null; ip?: string | null; userAgent?: string | null }): Promise<void> {
    void input;
  },
};
