import request from 'supertest';
import app from '../../src/app';
import { createUserRecord } from '../../src/repositories/fakes/test-state';
import { signAccessToken } from '../../src/auth/session';
import { Role } from '../../src/domain/enums';

describe('Sector and admin management', () => {
  it('creates a sector and exposes only active sectors publicly', async () => {
    const admin = createUserRecord({
      name: 'Admin Master',
      email: 'admin.master@helpdesk.local',
      passwordHash: 'hash-admin',
      role: Role.SUPERUSER,
    });

    const token = signAccessToken(admin);

    const created = await request(app)
      .post('/api/v1/admin/sectors')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:5173')
      .send({ name: 'TI' });

    expect(created.status).toBe(201);
    expect(created.body.data.name).toBe('TI');

    const list = await request(app).get('/api/v1/sectors');
    expect(list.status).toBe(200);
    expect(list.body.data.some((sector: { name: string }) => sector.name === 'TI')).toBe(true);
  });

  it('creates a technician for the superuser and toggles active status', async () => {
    const admin = createUserRecord({
      name: 'Root Admin',
      email: 'root.admin@helpdesk.local',
      passwordHash: 'hash-admin',
      role: Role.SUPERUSER,
    });
    const token = signAccessToken(admin);

    const created = await request(app)
      .post('/api/v1/admin/technicians')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:5173')
      .send({
        name: 'Técnico Silva',
        email: 'tecnico@exemplo.com',
        password: 'SenhaTecnico123',
      });

    expect(created.status).toBe(201);
    expect(created.body.data.user.role).toBe('TECHNICIAN');
    expect(created.body.data.user.mustChangePassword).toBe(true);

    const toggled = await request(app)
      .patch(`/api/v1/admin/technicians/${created.body.data.user.id}/status`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:5173')
      .send({ isActive: false });

    expect(toggled.status).toBe(200);
    expect(toggled.body.data.user.isActive).toBe(false);
  });

  it('validates admin payloads, forbidden roles and missing admin resources', async () => {
    const admin = createUserRecord({
      name: 'Admin Validador',
      email: 'admin.validador@helpdesk.local',
      passwordHash: 'hash-admin',
      role: Role.SUPERUSER,
    });
    const token = signAccessToken(admin);

    const invalidSector = await request(app)
      .post('/api/v1/admin/sectors')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:5173')
      .send({ name: 'A' });
    expect(invalidSector.status).toBe(400);
    expect(invalidSector.body.error.code).toBe('VALIDATION_ERROR');

    const missingSector = await request(app)
      .patch('/api/v1/admin/sectors/999999')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:5173')
      .send({ name: 'Infra' });
    expect(missingSector.status).toBe(404);
    expect(missingSector.body.error.code).toBe('SECTOR_NOT_FOUND');

    const invalidStatus = await request(app)
      .patch('/api/v1/admin/technicians/1/status')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:5173')
      .send({ isActive: 'false' });
    expect(invalidStatus.status).toBe(400);
    expect(invalidStatus.body.error.code).toBe('VALIDATION_ERROR');

    const client = createUserRecord({
      name: 'Cliente Sem Acesso',
      email: 'cliente.semacesso@helpdesk.local',
      passwordHash: 'hash-client',
      role: Role.CLIENT,
    });
    const clientToken = signAccessToken(client);

    const forbidden = await request(app)
      .get('/api/v1/admin/technicians')
      .set('Authorization', `Bearer ${clientToken}`)
      .set('Origin', 'http://localhost:5173');

    expect(forbidden.status).toBe(401);
    expect(forbidden.body.error.code).toBe('FORBIDDEN');

    const sector = await request(app)
      .post('/api/v1/admin/sectors')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:5173')
      .send({ name: 'Suporte' });

    const technician = await request(app)
      .post('/api/v1/admin/technicians')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:5173')
      .send({
        name: 'Técnico Atualizador',
        email: 'tecnico.atualizador@exemplo.com',
        password: 'SenhaTecnico123',
      });

    const patchSector = await request(app)
      .patch(`/api/v1/admin/technicians/${technician.body.data.user.id}`)
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:5173')
      .send({ sectorId: sector.body.data.id });

    expect(patchSector.status).toBe(200);
    expect(patchSector.body.data.user.sectorId).toBe(sector.body.data.id);

    const missingTech = await request(app)
      .patch('/api/v1/admin/technicians/999999/status')
      .set('Authorization', `Bearer ${token}`)
      .set('Origin', 'http://localhost:5173')
      .send({ isActive: true });

    expect(missingTech.status).toBe(404);
    expect(missingTech.body.error.code).toBe('TECHNICIAN_NOT_FOUND');
  });
});
