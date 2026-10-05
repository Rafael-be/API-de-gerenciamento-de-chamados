import { appConfig } from '../config/env';
import * as mysqlRepositories from './mysql';
import * as fakeRepositories from './fakes/memory-repositories';

const repos = appConfig.nodeEnv === 'production' ? mysqlRepositories : fakeRepositories;

export const userRepository = repos.userRepository;
export const sectorRepository = repos.sectorRepository;
export const ticketRepository = repos.ticketRepository;
export const commentRepository = repos.commentRepository;
export const notificationRepository = repos.notificationRepository;
export const refreshTokenRepository = repos.refreshTokenRepository;
export const auditLogRepository = repos.auditLogRepository;

export * from './interfaces';
