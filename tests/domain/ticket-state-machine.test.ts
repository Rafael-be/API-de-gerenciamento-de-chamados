import { describe, expect, it } from '@jest/globals';
import { TicketStatus } from '../../src/domain/enums';
import { canTransitionTicketStatus } from '../../src/domain/ticket-state-machine';

describe('Ticket state machine', () => {
  it.each([
    [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, true],
    [TicketStatus.OPEN, TicketStatus.CANCELLED, true],
    [TicketStatus.IN_PROGRESS, TicketStatus.RESOLVED, true],
    [TicketStatus.IN_PROGRESS, TicketStatus.OPEN, true],
    [TicketStatus.IN_PROGRESS, TicketStatus.CANCELLED, true],
  ])('allows transition %s -> %s', (from, to, expected) => {
    expect(canTransitionTicketStatus(from, to)).toBe(expected);
  });

  it.each([
    [TicketStatus.RESOLVED, TicketStatus.OPEN],
    [TicketStatus.RESOLVED, TicketStatus.IN_PROGRESS],
    [TicketStatus.CANCELLED, TicketStatus.OPEN],
    [TicketStatus.CANCELLED, TicketStatus.RESOLVED],
    [TicketStatus.OPEN, TicketStatus.RESOLVED],
    [TicketStatus.RESOLVED, TicketStatus.CANCELLED],
    [TicketStatus.CANCELLED, TicketStatus.CANCELLED],
  ])('blocks transition %s -> %s', (from, to) => {
    expect(canTransitionTicketStatus(from, to)).toBe(false);
  });
});
