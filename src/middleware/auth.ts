import type { NextFunction, Request, Response } from 'express';
import { Role } from '../domain/enums';
import type { User } from '../domain/models';
import { AuthError, ForbiddenError } from '../errors/app-error';
import { verifyAccessToken } from '../auth/session';
import { findUserById } from '../services/auth.service';

export interface AuthenticatedRequest extends Request {
  user?: User;
}

export function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const headerValue = req.headers.authorization;
  const tokenFromHeader = typeof headerValue === 'string' && headerValue.startsWith('Bearer ')
    ? headerValue.slice('Bearer '.length).trim()
    : undefined;
  const tokenFromCookie = typeof req.cookies?.access_token === 'string' ? req.cookies.access_token : undefined;
  const token = tokenFromHeader ?? tokenFromCookie;

  if (!token) {
    next(new AuthError('AUTH_REQUIRED', 'Token de autenticacao ausente.'));
    return;
  }

  let userId: number;
  try {
    const payload = verifyAccessToken(token);
    userId = Number(payload.sub);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      throw new Error('INVALID_ACCESS_TOKEN');
    }
  } catch {
    next(new AuthError('INVALID_ACCESS_TOKEN', 'Token de acesso invalido ou expirado.'));
    return;
  }

  void findUserById(userId).then((user) => {
    if (!user) {
      next(new AuthError('AUTH_REQUIRED', 'Usuario nao encontrado para este token.'));
      return undefined;
    }

    if (!user.isActive) {
      next(new AuthError('ACCOUNT_DISABLED', 'Esta conta esta desativada.'));
      return undefined;
    }

    const allowedPaths = ['/me', '/me/email', '/me/password', '/auth/logout'];
    if (user.mustChangePassword && !allowedPaths.includes(req.path)) {
      next(new ForbiddenError('MUST_CHANGE_PASSWORD', 'Voce precisa trocar a senha antes de continuar.'));
      return undefined;
    }

    req.user = user;
    next();
  }).catch((error: unknown) => {
    next(error);
  });
}

export function requireRole(requiredRole: Role) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AuthError('AUTH_REQUIRED', 'Token de autenticacao ausente.'));
      return;
    }

    if (req.user.role !== requiredRole) {
      next(new AuthError('FORBIDDEN', 'Voce nao tem permissao para acessar este recurso.'));
      return;
    }

    next();
  };
}
