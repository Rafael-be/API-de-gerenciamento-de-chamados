import { appConfig } from '../config/env';
import * as mysqlRepositories from './mysql';

const repos: typeof mysqlRepositories = appConfig.nodeEnv === 'test'
  // Load fake storage only in test processes.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  ? require('./fakes/memory-repositories') as typeof mysqlRepositories
  : mysqlRepositories;

export const userRepository = repos.userRepository;
export const sectorRepository = repos.sectorRepository;
export const ticketRepository = repos.ticketRepository;
export const commentRepository = repos.commentRepository;
export const notificationRepository = repos.notificationRepository;
export const refreshTokenRepository = repos.refreshTokenRepository;
export const socketTicketRepository = repos.socketTicketRepository;
export const auditLogRepository = repos.auditLogRepository;

export * from './interfaces';
