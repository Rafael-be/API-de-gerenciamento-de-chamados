import type { NextFunction, Request, Response } from 'express';
import { Role } from '../domain/enums';
import type { User } from '../domain/models';
import { AuthError, ForbiddenError } from '../errors/app-error';
import { getUserById, verifyAccessToken } from '../auth/session';

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
    next(new AuthError('AUTH_REQUIRED', 'Token de autenticação ausente.'));
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    const user = getUserById(Number(payload.sub));

    if (!user) {
      next(new AuthError('AUTH_REQUIRED', 'Usuário não encontrado para este token.'));
      return;
    }

    if (!user.isActive) {
      next(new AuthError('ACCOUNT_DISABLED', 'Esta conta está desativada.'));
      return;
    }

    const allowedPaths = ['/api/v1/me', '/api/v1/me/password', '/api/v1/auth/logout'];
    if (user.mustChangePassword && !allowedPaths.includes(req.path)) {
      next(new ForbiddenError('MUST_CHANGE_PASSWORD', 'Você precisa trocar a senha antes de continuar.'));
      return;
    }

    req.user = user;
    next();
  } catch (error) {
    void error;
    next(new AuthError('INVALID_ACCESS_TOKEN', 'Token de acesso inválido ou expirado.'));
  }
}

export function requireRole(requiredRole: Role) {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AuthError('AUTH_REQUIRED', 'Token de autenticação ausente.'));
      return;
    }

    if (req.user.role !== requiredRole) {
      next(new AuthError('FORBIDDEN', 'Você não tem permissão para acessar este recurso.'));
      return;
    }

    next();
  };
}
