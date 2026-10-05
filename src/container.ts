import { appConfig } from './config/env';
import { mysqlPool, pingDatabase } from './config/database';
import * as mysqlRepositories from './repositories/mysql';
import * as services from './services';
import { unitOfWork } from './repositories/unit-of-work';

export function createProductionContainer() {
  return {
    database: mysqlPool,
    unitOfWork,
    repositories: mysqlRepositories,
    services,
    config: appConfig,
    nodeEnv: appConfig.nodeEnv,
    pingDatabase,
  };
}

export const container = createProductionContainer();

export function getRepositories() {
  return mysqlRepositories;
}
