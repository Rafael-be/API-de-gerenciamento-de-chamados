import { type NextFunction, type Request, type Response, Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { appConfig } from '../config/env';
import { AuthError, ConflictError, ValidationError } from '../errors/app-error';
import { clearSessionCookies, sanitizeUser, setSessionCookies } from '../auth/session';
import { requireAuth, type AuthenticatedRequest } from '../middleware/auth';
import { authRateLimiter } from '../middleware/security';
import { findUserByEmail, loginUser, refreshSession, registerUser, revokeRefreshToken, updateUser } from '../services/auth.service';

const authRouter = Router();

const passwordSchema = z.string()
  .min(8, 'Senha deve ter pelo menos 8 caracteres.')
  .refine((value) => /[A-Za-z]/.test(value) && /\d/.test(value), {
    message: 'Senha deve conter letras e numeros.',
  });

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres.'),
  email: z.string().trim().email('E-mail invalido.'),
  password: passwordSchema,
});

const loginSchema = z.object({
  email: z.string().trim().email('E-mail invalido.'),
  password: z.string().min(1, 'Senha e obrigatoria.'),
});

const updateProfileSchema = z.object({
  name: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres.').optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Senha atual obrigatoria.'),
  newPassword: passwordSchema,
});

const updateEmailSchema = z.object({
  email: z.string().trim().email('E-mail invalido.'),
  currentPassword: z.string().min(1, 'Senha atual obrigatoria.'),
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
      throw new ValidationError('Dados de cadastro invalidos.', { issues: parsed.error.flatten() });
    }

    const { name, email, password } = parsed.data;
    const existingUser = await findUserByEmail(email);

    if (existingUser) {
      throw new ConflictError('EMAIL_ALREADY_REGISTERED', 'Este e-mail ja esta em uso.');
    }

    const { user, accessToken, refreshToken } = await registerUser({ name, email, password }, { requestId: req.requestId });
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
      throw new ValidationError('Dados de login invalidos.', { issues: parsed.error.flatten() });
    }

    const { email, password } = parsed.data;
    const { user, accessToken, refreshToken } = await loginUser({ email, password }, { requestId: req.requestId });
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

    const { user, accessToken, refreshToken } = await refreshSession(refreshTokenValue, { requestId: req.requestId });
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
  '/auth/logout',
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const refreshTokenValue = typeof req.cookies?.refresh_token === 'string' ? req.cookies.refresh_token : undefined;

    if (refreshTokenValue) {
      await revokeRefreshToken(refreshTokenValue, { requestId: req.requestId });
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
      throw new AuthError('AUTH_REQUIRED', 'Usuario nao autenticado.');
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
      throw new ValidationError('Dados invalidos para atualizacao do perfil.', { issues: parsed.error.flatten() });
    }

    const user = req.user;
    if (!user) {
      throw new AuthError('AUTH_REQUIRED', 'Usuario nao autenticado.');
    }

    const updatedUser = parsed.data.name
      ? await updateUser(user.id, { name: parsed.data.name }, { actorId: user.id, requestId: req.requestId })
      : user;

    res.json({
      success: true,
      data: {
        user: sanitizeUser(updatedUser ?? user),
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
      throw new ValidationError('Dados invalidos para atualizacao de e-mail.', { issues: parsed.error.flatten() });
    }

    const user = req.user;
    if (!user) {
      throw new AuthError('AUTH_REQUIRED', 'Usuario nao autenticado.');
    }

    const isCurrentPasswordValid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
    if (!isCurrentPasswordValid) {
      throw new AuthError('WRONG_CURRENT_PASSWORD', 'Senha atual incorreta.', { code: 'WRONG_CURRENT_PASSWORD' });
    }

    const existingUser = await findUserByEmail(parsed.data.email);
    if (existingUser && existingUser.id !== user.id) {
      throw new ConflictError('EMAIL_ALREADY_REGISTERED', 'Este e-mail ja esta em uso.');
    }

    const updatedUser = await updateUser(user.id, {
      email: parsed.data.email.toLowerCase(),
    }, { actorId: user.id, requestId: req.requestId });

    res.json({
      success: true,
      data: {
        user: sanitizeUser(updatedUser ?? user),
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
      throw new ValidationError('Dados invalidos para troca de senha.', { issues: parsed.error.flatten() });
    }

    const user = req.user;
    if (!user) {
      throw new AuthError('AUTH_REQUIRED', 'Usuario nao autenticado.');
    }

    const isCurrentPasswordValid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);

    if (!isCurrentPasswordValid) {
      throw new AuthError('WRONG_CURRENT_PASSWORD', 'Senha atual incorreta.', { code: 'WRONG_CURRENT_PASSWORD' });
    }

    const isSamePassword = await bcrypt.compare(parsed.data.newPassword, user.passwordHash);
    if (isSamePassword) {
      throw new AuthError('SAME_PASSWORD', 'A nova senha deve ser diferente da atual.');
    }

    const updatedUser = await updateUser(user.id, {
      passwordHash: await bcrypt.hash(parsed.data.newPassword, appConfig.bcryptRounds),
      passwordChangedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
      mustChangePassword: false,
    }, { actorId: user.id, requestId: req.requestId });

    res.json({
      success: true,
      data: {
        user: sanitizeUser(updatedUser ?? user),
      },
    });
  }),
);

export default authRouter;
