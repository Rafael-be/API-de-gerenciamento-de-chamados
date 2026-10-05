import { type Request, type Response, Router } from 'express';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { appConfig } from '../config/env';
import { Role } from '../domain/enums';
import { NotFoundError, ValidationError } from '../errors/app-error';
import { requireAuth, requireRole, type AuthenticatedRequest } from '../middleware/auth';
import { adminCreateSector, adminCreateTechnician, adminListActiveSectors, adminListAllSectors, adminListTechnicians, adminToggleTechnicianStatus, adminUpdateSector, adminAssignTechnicianSector, sanitizePublicUser } from '../services/admin.service';

const adminRouter = Router();

const sectorSchema = z.object({
  name: z.string().trim().min(2, 'Nome do setor é obrigatório.'),
  isActive: z.boolean().optional(),
});

const technicianSchema = z.object({
  name: z.string().trim().min(2, 'Nome deve ter pelo menos 2 caracteres.'),
  email: z.string().trim().email('E-mail inválido.'),
  password: z.string().min(8, 'Senha deve ter pelo menos 8 caracteres.').refine((value) => /[A-Za-z]/.test(value) && /\d/.test(value), {
    message: 'Senha deve conter letras e números.',
  }),
  sectorId: z.coerce.number().int().positive().optional().nullable(),
});

const patchStatusSchema = z.object({
  isActive: z.boolean(),
});

adminRouter.get('/sectors', async (_req: Request, res: Response) => {
  const sectors = await adminListActiveSectors();
  res.json({
    success: true,
    data: sectors,
  });
});

adminRouter.post('/admin/sectors', requireAuth, requireRole(Role.SUPERUSER), async (req: AuthenticatedRequest, res: Response) => {
  const parsed = sectorSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dados do setor inválidos.',
        details: parsed.error.flatten(),
      },
      requestId: 'req-local',
    });
    return;
  }

  const sector = await adminCreateSector(parsed.data.name, parsed.data.isActive ?? true);
  res.status(201).json({
    success: true,
    data: sector,
  });
});

adminRouter.get('/admin/sectors', requireAuth, requireRole(Role.SUPERUSER), async (_req: AuthenticatedRequest, res: Response) => {
  const sectors = await adminListAllSectors();
  res.json({
    success: true,
    data: sectors,
  });
});

adminRouter.patch('/admin/sectors/:id', requireAuth, requireRole(Role.SUPERUSER), async (req: Request, res: Response) => {
  const sectorId = Number(req.params.id);
  const parsed = sectorSchema.safeParse(req.body);

  if (!Number.isInteger(sectorId) || sectorId <= 0) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Identificador do setor inválido.',
      },
      requestId: 'req-local',
    });
    return;
  }

  if (!parsed.success) {
    throw new ValidationError('Dados do setor inválidos.', { issues: parsed.error.flatten() });
  }

  const sector = await adminUpdateSector(sectorId, {
    name: parsed.data.name,
    isActive: parsed.data.isActive ?? true,
  });

  if (!sector) {
    throw new NotFoundError('SECTOR_NOT_FOUND', 'Setor não encontrado.');
  }

  res.json({
    success: true,
    data: sector,
  });
});

adminRouter.get('/admin/technicians', requireAuth, requireRole(Role.SUPERUSER), async (_req: Request, res: Response) => {
  const technicians = (await adminListTechnicians()).map((user) => sanitizePublicUser(user));

  res.json({
    success: true,
    data: technicians,
  });
});

adminRouter.post('/admin/technicians', requireAuth, requireRole(Role.SUPERUSER), async (req: Request, res: Response) => {
  const parsed = technicianSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ValidationError('Dados do técnico inválidos.', { issues: parsed.error.flatten() });
  }

  const { name, email, password, sectorId } = parsed.data;
  const passwordHash = await bcrypt.hash(password, appConfig.bcryptRounds);
  const user = await adminCreateTechnician({
    name,
    email,
    passwordHash,
    sectorId: sectorId ?? null,
  });

  res.status(201).json({
    success: true,
    data: {
      user: sanitizePublicUser(user),
    },
  });
});

adminRouter.patch('/admin/technicians/:id/status', requireAuth, requireRole(Role.SUPERUSER), async (req: Request, res: Response) => {
  const parsed = patchStatusSchema.safeParse(req.body);

  if (!parsed.success) {
    throw new ValidationError('Dados inválidos para status do técnico.', { issues: parsed.error.flatten() });
  }

  const userId = Number(req.params.id);
  const user = await adminToggleTechnicianStatus(userId, parsed.data.isActive);

  if (!user || user.role !== Role.TECHNICIAN) {
    throw new NotFoundError('TECHNICIAN_NOT_FOUND', 'Técnico não encontrado.');
  }

  res.json({
    success: true,
    data: {
      user: sanitizePublicUser(user),
    },
  });
});

adminRouter.patch('/admin/technicians/:id', requireAuth, requireRole(Role.SUPERUSER), async (req: Request, res: Response) => {
  const userId = Number(req.params.id);
  const rawSectorId = Number(req.body?.sectorId);

  const user = await adminAssignTechnicianSector(userId, Number.isFinite(rawSectorId) && rawSectorId > 0 ? rawSectorId : null);
  if (!user || user.role !== Role.TECHNICIAN) {
    throw new NotFoundError('TECHNICIAN_NOT_FOUND', 'Técnico não encontrado.');
  }

  if (Number.isFinite(rawSectorId) && rawSectorId > 0 && !user.sectorId) {
    throw new NotFoundError('SECTOR_NOT_FOUND', 'Setor não encontrado.');
  }

  res.json({
    success: true,
    data: {
      user: sanitizePublicUser(user),
    },
  });
});

export default adminRouter;
