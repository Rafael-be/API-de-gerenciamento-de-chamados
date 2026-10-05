import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { appConfig } from './config/env';
import authRouter from './routes/auth';
import adminRouter from './routes/admin';
import ticketRouter from './routes/tickets';
import commentRouter from './routes/comments';
import notificationRouter from './routes/notifications';
import { AppError, DatabaseError } from './errors/app-error';
import { addRequestIdHeader, attachRequestId } from './middleware/security';
import { pingDatabase } from './config/database';

export interface AppDependencies {
  nodeEnv: string;
  pingDatabase: typeof pingDatabase;
}

export function createApp(dependencies: AppDependencies = {
  nodeEnv: appConfig.nodeEnv,
  pingDatabase,
}): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(attachRequestId);
  app.use(addRequestIdHeader);
  app.use(helmet());
  app.use(cors({
    origin(origin, callback) {
      if (!origin || appConfig.corsOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('INVALID_ORIGIN'));
    },
    credentials: true,
  }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/api/v1/health', async (_req: Request, res: Response, next: NextFunction) => {
    try {
      if (dependencies.nodeEnv !== 'test') {
        await dependencies.pingDatabase();
      }

      res.status(200).json({
        success: true,
        data: {
          ok: true,
          database: dependencies.nodeEnv === 'test' ? 'skipped' : 'ok',
          uptimeSeconds: Number(process.uptime().toFixed(2)),
          timestamp: new Date().toISOString(),
        },
      });
    } catch {
      next(new DatabaseError('Banco de dados indisponível.'));
    }
  });

  app.get('/api/docs', (_req: Request, res: Response) => {
    const openApiDocument = {
      openapi: '3.0.0',
      info: {
        title: 'Helpdesk API',
        version: '1.0.0',
        description: 'API REST para gerenciamento de chamados de suporte técnico.',
      },
      servers: [
        { url: 'http://localhost:3000' },
      ],
      paths: {
        '/health': {
          get: {
            summary: 'Health check da API',
            responses: {
              '200': {
                description: 'API funcional',
              },
            },
          },
        },
        '/auth/register': {
          post: {
            summary: 'Cadastro do cliente',
            responses: {
              '201': { description: 'Usuário criado' },
            },
          },
        },
        '/auth/login': {
          post: {
            summary: 'Login do usuário',
            responses: {
              '200': { description: 'Login realizado' },
            },
          },
        },
      },
    };

    res.status(200).json(openApiDocument);
  });

  app.use('/api/v1', authRouter);
  app.use('/api/v1', adminRouter);
  app.use('/api/v1', ticketRouter);
  app.use('/api/v1', commentRouter);
  app.use('/api/v1', notificationRouter);

  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'ROUTE_NOT_FOUND',
        message: 'Rota não encontrada.',
      },
      requestId: req.requestId,
    });
  });

  app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
    const malformedJson = error instanceof SyntaxError && 'body' in error && (error as SyntaxError & { type?: string }).type === 'entity.parse.failed';

    if (malformedJson) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_JSON',
          message: 'JSON inválido ou malformado.',
          details: null,
        },
        requestId: req.requestId,
      });
      return;
    }

    if (error instanceof AppError) {
      res.status(error.httpStatus).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details ?? null,
        },
        requestId: req.requestId,
      });
      return;
    }

    const message = error instanceof Error ? error.message : 'Erro interno inesperado.';
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message,
        details: null,
      },
      requestId: req.requestId,
    });
  });

  return app;
}

const app = createApp();

export default app;
