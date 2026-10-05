import type { Ticket, User } from '../domain/models';
export * from './admin.service';
export * from './auth.service';
export * from './comment.service';
export * from './notification.service';
export * from './ticket.service';

export interface IUserService {
  getProfile(userId: number): Promise<User | null>;
}

export interface ITicketService {
  createTicket(input: { clientId: number; title: string; description: string }): Promise<Ticket>;
  closeTicket(ticketId: number, actorId: number): Promise<Ticket>;
}
