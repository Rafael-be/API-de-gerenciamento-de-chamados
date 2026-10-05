import { Role, TicketStatus } from './enums';

export interface TicketAccessContext {
  role: Role;
  isOwner?: boolean;
  isAssigned?: boolean;
  ticketStatus: TicketStatus;
}

export function canAccessTicketDetail(context: TicketAccessContext): boolean {
  const { role, isOwner = false, isAssigned = false, ticketStatus } = context;

  if (role === Role.CLIENT) {
    return isOwner && ticketStatus !== TicketStatus.CANCELLED;
  }

  if (role === Role.TECHNICIAN) {
    return (
      ticketStatus === TicketStatus.OPEN && !isAssigned
    ) || (
      (ticketStatus === TicketStatus.IN_PROGRESS || ticketStatus === TicketStatus.RESOLVED) && isAssigned
    );
  }

  return false;
}

export function canEditTicket(context: TicketAccessContext): boolean {
  return context.role === Role.CLIENT && (context.isOwner ?? false) && context.ticketStatus === TicketStatus.OPEN;
}

export function canPerformTicketTransition(context: TicketAccessContext): boolean {
  return context.role === Role.TECHNICIAN && context.isAssigned === true && context.ticketStatus === TicketStatus.IN_PROGRESS;
}
