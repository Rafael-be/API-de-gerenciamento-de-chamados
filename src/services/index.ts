import type { Ticket, User } from '../domain/models';

export interface IUserService {
  getProfile(userId: number): Promise<User | null>;
}

export interface ITicketService {
  createTicket(input: { clientId: number; title: string; description: string }): Promise<Ticket>;
  closeTicket(ticketId: number, actorId: number): Promise<Ticket>;
}
