import { describe, expect, it } from '@jest/globals';
import { Role, TicketStatus } from '../../src/domain/enums';
import { canAccessTicketDetail, canEditTicket, canPerformTicketTransition } from '../../src/domain/policies';

describe('Permission policies', () => {
  it('allows the ticket owner to view and edit open tickets', () => {
    expect(canAccessTicketDetail({ role: Role.CLIENT, isOwner: true, ticketStatus: TicketStatus.OPEN })).toBe(true);
    expect(canEditTicket({ role: Role.CLIENT, isOwner: true, ticketStatus: TicketStatus.OPEN })).toBe(true);
  });

  it('blocks other clients and non-assigned technicians', () => {
    expect(canAccessTicketDetail({ role: Role.CLIENT, isOwner: false, ticketStatus: TicketStatus.OPEN })).toBe(false);
    expect(canEditTicket({ role: Role.TECHNICIAN, isOwner: false, ticketStatus: TicketStatus.OPEN })).toBe(false);
    expect(canPerformTicketTransition({ role: Role.TECHNICIAN, isAssigned: false, ticketStatus: TicketStatus.OPEN })).toBe(false);
    expect(canAccessTicketDetail({ role: Role.SUPERUSER, ticketStatus: TicketStatus.OPEN })).toBe(false);
  });

  it('allows the assigned technician to read and transition in-progress tickets', () => {
    expect(canAccessTicketDetail({ role: Role.TECHNICIAN, isAssigned: true, ticketStatus: TicketStatus.IN_PROGRESS })).toBe(true);
    expect(canAccessTicketDetail({ role: Role.TECHNICIAN, isAssigned: false, ticketStatus: TicketStatus.OPEN })).toBe(true);
    expect(canAccessTicketDetail({ role: Role.TECHNICIAN, isAssigned: true, ticketStatus: TicketStatus.RESOLVED })).toBe(true);
    expect(canPerformTicketTransition({ role: Role.TECHNICIAN, isAssigned: true, ticketStatus: TicketStatus.IN_PROGRESS })).toBe(true);
  });

  it('prevents invalid edit attempts and transitions', () => {
    expect(canEditTicket({ role: Role.CLIENT, isOwner: false, ticketStatus: TicketStatus.OPEN })).toBe(false);
    expect(canEditTicket({ role: Role.CLIENT, isOwner: true, ticketStatus: TicketStatus.RESOLVED })).toBe(false);
    expect(canPerformTicketTransition({ role: Role.CLIENT, isOwner: false, ticketStatus: TicketStatus.IN_PROGRESS })).toBe(false);
  });
});
