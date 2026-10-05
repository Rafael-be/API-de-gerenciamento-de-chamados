import type { NextFunction, Request, Response } from 'express';
import crypto from 'node:crypto';
import { RateLimitError } from '../errors/app-error';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
    }
  }
}

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function attachRequestId(req: Request, _res: Response, next: NextFunction): void {
  req.requestId = (req.get('x-request-id') ?? crypto.randomUUID()).toString();
  next();
}

export function addRequestIdHeader(req: Request, res: Response, next: NextFunction): void {
  res.setHeader('x-request-id', req.requestId);
  next();
}

export function createRateLimiter(maxRequests: number, windowMs: number, keyFactory: (req: Request) => string = (req) => req.ip || 'unknown') {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const key = keyFactory(req);
    const now = Date.now();
    const record = rateLimitStore.get(key);

    if (record && record.resetAt > now) {
      if (record.count >= maxRequests) {
        next(new RateLimitError(`Muitas tentativas em pouco tempo. Tente novamente em ${Math.ceil((record.resetAt - now) / 1000)}s.`, Math.max(1, Math.ceil((record.resetAt - now) / 1000))));
        return;
      }

      record.count += 1;
      next();
      return;
    }

    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    next();
  };
}

export const authRateLimiter = createRateLimiter(15, 60_000, (req) => `${req.ip || 'unknown'}:${req.path}`);
