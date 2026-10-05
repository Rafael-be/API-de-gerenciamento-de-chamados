import http from 'node:http';
import pino from 'pino';
import { createApp } from './app';
import { appConfig } from './config/env';
import { container } from './container';
import { attachSocketServer } from './socket/notifications';

const logger = pino({ level: appConfig.logLevel });
const port = appConfig.port;
const app = createApp(container);
const server = http.createServer(app);
attachSocketServer(server);

async function startServer(): Promise<void> {
  await container.pingDatabase();

  server.listen(port, () => {
    logger.info(`API helpdesk em execução na porta ${port}`);
    logger.info(`Conectado ao MySQL ${appConfig.dbName} em ${appConfig.dbHost}:${appConfig.dbPort}`);
  });
}

startServer().catch((error: unknown) => {
  const errorCode = typeof error === 'object' && error !== null && 'code' in error
    ? String(error.code)
    : 'ERRO_DESCONHECIDO';
  logger.error(
    { errorCode, host: appConfig.dbHost, port: appConfig.dbPort, database: appConfig.dbName },
    `Falha ao conectar ao MySQL em ${appConfig.dbHost}:${appConfig.dbPort}/${appConfig.dbName}. Verifique o serviço, a configuração e as permissões do usuário.`,
  );
  process.exit(1);
});
