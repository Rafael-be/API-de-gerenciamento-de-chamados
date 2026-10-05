import { Role, UserStatus } from '../domain/enums';
import type { Sector, User } from '../domain/models';
import { sectorRepository, userRepository } from '../repositories';
import type { UnitOfWorkContext } from '../repositories/unit-of-work';

export type PublicUser = Omit<User, 'passwordHash'>;

export function sanitizePublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    sectorId: user.sectorId,
    isActive: user.isActive,
    mustChangePassword: user.mustChangePassword,
    passwordChangedAt: user.passwordChangedAt,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    status: user.status,
  };
}

export async function adminListActiveSectors(): Promise<Sector[]> {
  return sectorRepository.findActive();
}

export async function adminListAllSectors(): Promise<Sector[]> {
  return sectorRepository.findAll();
}

export async function adminCreateSector(name: string, isActive = true, context: UnitOfWorkContext = {}): Promise<Sector> {
  return sectorRepository.create(name, isActive, context);
}

export async function adminUpdateSector(id: number, patch: Partial<Sector>, context: UnitOfWorkContext = {}): Promise<Sector | null> {
  return sectorRepository.update(id, patch, context);
}

export async function adminListTechnicians(): Promise<User[]> {
  return userRepository.listByRole(Role.TECHNICIAN);
}

export async function adminCreateTechnician(input: { name: string; email: string; passwordHash: string; sectorId: number | null }, context: UnitOfWorkContext = {}): Promise<User> {
  const existing = await userRepository.findByEmail(input.email);
  if (existing) {
    throw new Error('TECHNICIAN_ALREADY_EXISTS');
  }

  return userRepository.create({
    name: input.name,
    email: input.email,
    passwordHash: input.passwordHash,
    role: Role.TECHNICIAN,
    sectorId: input.sectorId,
    isActive: true,
    mustChangePassword: true,
    passwordChangedAt: null,
    lastLoginAt: null,
    status: UserStatus.ACTIVE,
  }, context);
}

export async function adminToggleTechnicianStatus(userId: number, isActive: boolean, context: UnitOfWorkContext = {}): Promise<User | null> {
  const existing = await userRepository.findById(userId);
  if (!existing || existing.role !== Role.TECHNICIAN) {
    return null;
  }

  if (!isActive) {
    await userRepository.deactivateTechnician(userId, context);
    return userRepository.findById(userId);
  }

  return userRepository.update(userId, { isActive: true, status: UserStatus.ACTIVE }, context);
}

export async function adminAssignTechnicianSector(userId: number, sectorId: number | null, context: UnitOfWorkContext = {}): Promise<User | null> {
  const existing = await userRepository.findById(userId);
  if (!existing || existing.role !== Role.TECHNICIAN) {
    return null;
  }

  return userRepository.update(userId, { sectorId }, context);
}
