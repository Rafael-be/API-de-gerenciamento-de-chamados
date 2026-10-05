import app from './app';
import { appConfig } from './config/env';

const port = appConfig.port;

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`API helpdesk em execução na porta ${port}`);
});
