import express, { type Express, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { appConfig } from './config/env';

function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: appConfig.corsOrigins, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/api/v1/health', (_req: Request, res: Response) => {
    res.status(200).json({
      success: true,
      data: {
        ok: true,
        uptimeSeconds: Number(process.uptime().toFixed(2)),
        timestamp: new Date().toISOString(),
      },
    });
  });

  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'Rota não encontrada.',
      },
    });
  });

  return app;
}

const app = createApp();

export default app;
