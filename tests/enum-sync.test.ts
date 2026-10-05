import { describe, expect, it } from '@jest/globals';
import { NotificationType, Role, TicketStatus } from '../src/domain/enums';

describe('Database enum parity', () => {
  it('keeps TypeScript enums aligned with the official DB enum values', () => {
    expect(Object.values(Role)).toEqual(['SUPERUSER', 'TECHNICIAN', 'CLIENT']);
    expect(Object.values(TicketStatus)).toEqual(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED']);
    expect(Object.values(NotificationType)).toEqual([
      'TICKET_ASSUMED',
      'TICKET_RETURNED',
      'TICKET_RESOLVED',
      'TICKET_CANCELLED',
      'TECHNICIAN_DEACTIVATED',
      'COMMENT_CREATED',
    ]);
  });
});
