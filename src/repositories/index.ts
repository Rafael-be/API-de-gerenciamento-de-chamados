import type { Ticket } from '../domain/models';

export interface ITicketRepository {
  findById(ticketId: number): Promise<Ticket | null>;
  save(ticket: Ticket): Promise<Ticket>;
}

export interface IUserRepository {
  findById(userId: number): Promise<unknown>;
}
