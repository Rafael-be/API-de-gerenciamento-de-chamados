import type { NotificationType, Role, TicketStatus, UserStatus } from './enums';

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  passwordHash: string;
  sectorId: number | null;
  isActive: boolean;
  mustChangePassword: boolean;
  passwordChangedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  status: UserStatus;
}

export interface Sector {
  id: number;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Ticket {
  id: number;
  clientId: number;
  technicianId: number | null;
  sectorId: number | null;
  title: string;
  description: string;
  status: TicketStatus;
  resolutionNote: string | null;
  createdAt: string;
  updatedAt: string;
  assumedAt: string | null;
  resolvedAt: string | null;
  cancelledAt: string | null;
}

export interface TicketComment {
  id: number;
  ticketId: number;
  authorId: number;
  parentId: number | null;
  body: string;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
}

export interface Notification {
  id: number;
  userId: number;
  type: NotificationType;
  ticketId: number | null;
  commentId: number | null;
  actorId: number | null;
  message: string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total?: number;
  totalPages?: number;
  hasNext?: boolean;
  offset?: number;
}
