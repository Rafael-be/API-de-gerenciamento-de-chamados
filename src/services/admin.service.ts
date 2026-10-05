import { Role, UserStatus } from '../domain/enums';
import type { Sector, User } from '../domain/models';
import { sectorRepository, userRepository } from '../repositories';

export type PublicUser = Omit<User, 'passwordHash'>;

export function sanitizePublicUser(user: User): PublicUser {
  const { passwordHash: _passwordHash, ...publicUser } = user;
  return publicUser;
}

export async function adminListActiveSectors(): Promise<Sector[]> {
  return sectorRepository.findActive();
}

export async function adminListAllSectors(): Promise<Sector[]> {
  return sectorRepository.findAll();
}

export async function adminCreateSector(name: string, isActive = true): Promise<Sector> {
  return sectorRepository.create(name, isActive);
}

export async function adminUpdateSector(id: number, patch: Partial<Sector>): Promise<Sector | null> {
  return sectorRepository.update(id, patch);
}

export async function adminListTechnicians(): Promise<User[]> {
  return userRepository.listByRole(Role.TECHNICIAN);
}

export async function adminCreateTechnician(input: { name: string; email: string; passwordHash: string; sectorId: number | null }): Promise<User> {
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
  });
}

export async function adminToggleTechnicianStatus(userId: number, isActive: boolean): Promise<User | null> {
  const existing = await userRepository.findById(userId);
  if (!existing || existing.role !== Role.TECHNICIAN) {
    return null;
  }

  return userRepository.update(userId, {
    isActive,
    status: isActive ? UserStatus.ACTIVE : UserStatus.INACTIVE,
  });
}

export async function adminAssignTechnicianSector(userId: number, sectorId: number | null): Promise<User | null> {
  const existing = await userRepository.findById(userId);
  if (!existing || existing.role !== Role.TECHNICIAN) {
    return null;
  }

  return userRepository.update(userId, { sectorId });
}
