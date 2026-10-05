import { TicketStatus } from './enums';

export { TicketStatus } from './enums';

const allowedTransitions: Record<TicketStatus, TicketStatus[]> = {
  [TicketStatus.OPEN]: [TicketStatus.IN_PROGRESS, TicketStatus.CANCELLED],
  [TicketStatus.IN_PROGRESS]: [TicketStatus.OPEN, TicketStatus.RESOLVED, TicketStatus.CANCELLED],
  [TicketStatus.RESOLVED]: [],
  [TicketStatus.CANCELLED]: [],
};

export function canTransitionTicketStatus(from: TicketStatus, to: TicketStatus): boolean {
  return allowedTransitions[from]?.includes(to) ?? false;
}
