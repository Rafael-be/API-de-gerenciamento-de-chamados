import http from 'node:http';
import app from './app';
import { appConfig } from './config/env';
import { attachSocketServer } from './socket/notifications';

const port = appConfig.port;
const server = http.createServer(app);
attachSocketServer(server);

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API helpdesk em execução na porta ${port}`);
});
