import { type NextFunction, type Request, type Response, Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { appConfig } from '../config/env';
import { Role } from '../domain/enums';
import { AuthError, ConflictError, ValidationError } from '../errors/app-error';
import {
  clearSessionCookies,
  createRefreshToken,
  createUserRecord,
  findRefreshSessionByToken,
  getUserByEmail,
  getUserById,
  hashToken,
  rotateRefreshToken,
  sanitizeUser,
  setSessionCookies,
  signAccessToken,
  upsertUser,
} from '../auth/session';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { authRateLimiter } from '../middleware/security';
import { findUserByEmail, loginUser, registerUser, updateUser } from '../services/auth.service';

const authRouter = Router();

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres.'),
  email: z.string().trim().email('E-mail inválido.'),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres.').refine((value) => /[A-Za-z]/.test(value) && /\d/.test(value), {
    message: 'Senha deve conter letras e números.',
  }),
});

const loginSchema = z.object({
  email: z.string().trim().email('E-mail inválido.'),
  password: z.string().min(1, 'Senha é obrigatória.'),
});

const updateProfileSchema = z.object({
  name: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres.').optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual obrigatória.'),
  newPassword: z.string().min(8, 'Nova senha deve ter pelo menos 8 caracteres.').refine((value) => /[A-Za-z]/.test(value) && /\d/.test(value), {
    message: 'Nova senha deve conter letras e números.',
  }),
});

const updateEmailSchema = z.object({
  email: z.string().trim().email('E-mail inválido.'),
  currentPassword: z.string().min(1, 'Senha atual obrigatória.'),
});

function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown> | unknown,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

authRouter.post(
  '/auth/register',
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ValidationError('Dados de cadastro inválidos.', { issues: parsed.error.flatten() });
    }

    const { name, email, password } = parsed.data;
    const existingUser = await findUserByEmail(email);

    if (existingUser) {
      throw new ConflictError('EMAIL_ALREADY_REGISTERED', 'Este e-mail já está em uso.');
    }

    const { user, accessToken, refreshToken } = await registerUser({ name, email, password });
    setSessionCookies(res, accessToken, refreshToken);

    res.status(201).json({
      success: true,
      data: {
        user: sanitizeUser(user),
      },
    });
  }),
);

authRouter.post(
  '/auth/login',
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ValidationError('Dados de login inválidos.', { issues: parsed.error.flatten() });
    }

    const { email, password } = parsed.data;
    const { user, accessToken, refreshToken } = await loginUser({ email, password });
    setSessionCookies(res, accessToken, refreshToken);

    res.json({
      success: true,
      data: {
        user: sanitizeUser(user),
      },
    });
  }),
);

authRouter.post(
  '/auth/refresh',
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const refreshTokenValue = typeof req.cookies?.refresh_token === 'string' ? req.cookies.refresh_token : undefined;

    if (!refreshTokenValue) {
      throw new AuthError('AUTH_REQUIRED', 'Refresh token ausente.');
    }

    const session = findRefreshSessionByToken(refreshTokenValue);

    if (!session) {
      throw new AuthError('INVALID_REFRESH_TOKEN', 'Refresh token inválido.');
    }

    if (session.expiresAt < Date.now()) {
      throw new AuthError('REFRESH_TOKEN_EXPIRED', 'Refresh token expirado.');
    }

    const rotated = rotateRefreshToken(refreshTokenValue);

    if (!rotated) {
      throw new AuthError('REFRESH_TOKEN_REUSED', 'Refresh token reutilizado.');
    }

    const user = getUserById(session.userId);

    if (!user || !user.isActive) {
      throw new AuthError('ACCOUNT_DISABLED', 'Conta desativada.');
    }

    const accessToken = signAccessToken(user);
    setSessionCookies(res, accessToken, rotated.tokenValue);

    res.json({
      success: true,
      data: {
        user: sanitizeUser(user),
      },
    });
  }),
);

authRouter.post(
  '/auth/logout',
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const refreshTokenValue = typeof req.cookies?.refresh_token === 'string' ? req.cookies.refresh_token : undefined;

    if (refreshTokenValue) {
      const session = findRefreshSessionByToken(refreshTokenValue);
      if (session) {
        const currentHash = hashToken(refreshTokenValue);
        if (currentHash === session.tokenHash) {
          const user = getUserById(session.userId);
          if (user && user.isActive) {
            // no-op; session is being revoked
          }
        }
      }
      const tokenHash = hashToken(refreshTokenValue);
      const record = findRefreshSessionByToken(refreshTokenValue);
      if (record) {
        const session = record;
        session.revokedAt = Date.now();
        const refreshSessionMap = new Map<string, unknown>();
        refreshSessionMap.set(tokenHash, session);
      }
    }

    clearSessionCookies(res);
    res.json({ success: true, data: { loggedOut: true } });
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const user = req.user;

    if (!user) {
      throw new AuthError('AUTH_REQUIRED', 'Usuário não autenticado.');
    }

    res.json({
      success: true,
      data: {
        user: sanitizeUser(user),
      },
    });
  }),
);

authRouter.patch(
  '/me',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = updateProfileSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ValidationError('Dados inválidos para atualização do perfil.', { issues: parsed.error.flatten() });
    }

    const user = req.user;
    if (!user) {
      throw new AuthError('AUTH_REQUIRED', 'Usuário não autenticado.');
    }

    if (parsed.data.name) {
      user.name = parsed.data.name;
      user.updatedAt = new Date().toISOString();
      upsertUser(user);
    }

    res.json({
      success: true,
      data: {
        user: sanitizeUser(user),
      },
    });
  }),
);

authRouter.patch(
  '/me/email',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = updateEmailSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ValidationError('Dados inválidos para atualização de e-mail.', { issues: parsed.error.flatten() });
    }

    const user = req.user;
    if (!user) {
      throw new AuthError('AUTH_REQUIRED', 'Usuário não autenticado.');
    }

    const isCurrentPasswordValid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      throw new AuthError('WRONG_CURRENT_PASSWORD', 'Senha atual incorreta.', { code: 'WRONG_CURRENT_PASSWORD' });
    }

    const existingUser = getUserByEmail(parsed.data.email);
    if (existingUser && existingUser.id !== user.id) {
      throw new ConflictError('EMAIL_ALREADY_REGISTERED', 'Este e-mail já está em uso.');
    }

    user.email = parsed.data.email.toLowerCase();
    user.updatedAt = new Date().toISOString();
    upsertUser(user);

    res.json({
      success: true,
      data: {
        user: sanitizeUser(user),
      },
    });
  }),
);

authRouter.patch(
  '/me/password',
  requireAuth,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new ValidationError('Dados inválidos para troca de senha.', { issues: parsed.error.flatten() });
    }

    const user = req.user;
    if (!user) {
      throw new AuthError('AUTH_REQUIRED', 'Usuário não autenticado.');
    }

    const isCurrentPasswordValid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);

    if (!isCurrentPasswordValid) {
      throw new AuthError('WRONG_CURRENT_PASSWORD', 'Senha atual incorreta.', { code: 'WRONG_CURRENT_PASSWORD' });
    }

    const isSamePassword = await bcrypt.compare(parsed.data.newPassword, user.passwordHash);
    if (isSamePassword) {
      throw new AuthError('SAME_PASSWORD', 'A nova senha deve ser diferente da atual.');
    }

    user.passwordHash = await bcrypt.hash(parsed.data.newPassword, appConfig.bcryptRounds);
    user.passwordChangedAt = new Date().toISOString();
    user.mustChangePassword = false;
    user.updatedAt = new Date().toISOString();
    upsertUser(user);

    res.json({
      success: true,
      data: {
        user: sanitizeUser(user),
      },
    });
  }),
);

export default authRouter;
