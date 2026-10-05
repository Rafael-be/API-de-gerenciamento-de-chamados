import { appConfig } from './config/env';
import * as mysqlRepositories from './repositories/mysql';
import * as fakeRepositories from './repositories/fakes/memory-repositories';

const useMysql = appConfig.nodeEnv === 'production';

export const container = {
  appConfig,
  repositories: useMysql ? mysqlRepositories : fakeRepositories,
};

export function getRepositories() {
  return container.repositories;
}
