import request from 'supertest';
import app from '../../src/app';
import {
  createRefreshToken,
  createUserRecord,
  findRefreshSessionByToken,
  rotateRefreshToken,
  sanitizeUser,
  signAccessToken,
  verifyAccessToken,
} from '../../src/auth/session';
import { Role } from '../../src/domain/enums';
import { requireAuth, requireRole } from '../../src/middleware/auth';

describe('Auth and session flow', () => {
  it('registers a client and returns a profile without exposing the password hash', async () => {
    const response = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Ana Souza',
        email: 'ana@exemplo.com',
        password: 'SenhaSegura123',
      })
      .set('Origin', 'http://localhost:5173');

    const setCookieHeader = Array.isArray(response.headers['set-cookie'])
      ? response.headers['set-cookie']
      : response.headers['set-cookie']
        ? [response.headers['set-cookie']]
        : [];

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user).toEqual(
      expect.objectContaining({
        id: expect.any(Number),
        name: 'Ana Souza',
        email: 'ana@exemplo.com',
        role: 'CLIENT',
      }),
    );
    expect(response.body.data.user.passwordHash).toBeUndefined();
    expect(setCookieHeader).toEqual(
      expect.arrayContaining([expect.stringContaining('access_token='), expect.stringContaining('refresh_token=')]),
    );
  });

  it('rejects requests without an access token', async () => {
    const response = await request(app).get('/api/v1/me');

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('AUTH_REQUIRED');
  });

  it('rejects duplicate registration and invalid login credentials', async () => {
    const first = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Carla Mendes',
        email: 'carla@exemplo.com',
        password: 'SenhaSegura123',
      })
      .set('Origin', 'http://localhost:5173');

    expect(first.status).toBe(201);

    const duplicate = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Outra Carla',
        email: 'carla@exemplo.com',
        password: 'SenhaSegura123',
      })
      .set('Origin', 'http://localhost:5173');

    expect(duplicate.status).toBe(409);
    expect(duplicate.body.error.code).toBe('EMAIL_ALREADY_REGISTERED');

    const invalidLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'carla@exemplo.com',
        password: 'SenhaErrada999',
      })
      .set('Origin', 'http://localhost:5173');

    expect(invalidLogin.status).toBe(401);
    expect(invalidLogin.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('logs in and refreshes a session', async () => {
    const registerResponse = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Bruno Lima',
        email: 'bruno@exemplo.com',
        password: 'SenhaSegura123',
      })
      .set('Origin', 'http://localhost:5173');

    expect(registerResponse.status).toBe(201);

    const cookies = Array.isArray(registerResponse.headers['set-cookie'])
      ? registerResponse.headers['set-cookie']
      : registerResponse.headers['set-cookie']
        ? [registerResponse.headers['set-cookie']]
        : [];
    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'bruno@exemplo.com',
        password: 'SenhaSegura123',
      })
      .set('Origin', 'http://localhost:5173')
      .set('Cookie', cookies);

    const loginSetCookie = Array.isArray(loginResponse.headers['set-cookie'])
      ? loginResponse.headers['set-cookie']
      : loginResponse.headers['set-cookie']
        ? [loginResponse.headers['set-cookie']]
        : [];

    expect(loginResponse.status).toBe(200);
    expect(loginSetCookie).toEqual(
      expect.arrayContaining([expect.stringContaining('access_token='), expect.stringContaining('refresh_token=')]),
    );

    const refreshCookie = loginSetCookie
      .map((cookie: string) => cookie.split(';')[0])
      .find((cookie): boolean => typeof cookie === 'string' && cookie.startsWith('refresh_token='));

    const refreshResponse = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', refreshCookie ? [refreshCookie] : [])
      .set('Origin', 'http://localhost:5173');

    expect(refreshResponse.status).toBe(200);
    expect(refreshResponse.body.success).toBe(true);
    expect(refreshResponse.body.data.user.email).toBe('bruno@exemplo.com');
  });

  it('validates token helpers and refresh rotation', () => {
    const user = createUserRecord({
      name: 'Diana Rocha',
      email: 'diana@exemplo.com',
      passwordHash: 'hashed-password',
      role: Role.CLIENT,
    });

    const accessToken = signAccessToken(user);
    const payload = verifyAccessToken(accessToken);
    const { tokenValue, familyId } = createRefreshToken(user.id);
    const session = findRefreshSessionByToken(tokenValue);
    const rotated = rotateRefreshToken(tokenValue);

    expect(payload.sub).toBe(String(user.id));
    expect('passwordHash' in sanitizeUser(user)).toBe(false);
    expect(session?.familyId).toBe(familyId);
    expect(rotated).not.toBeNull();
    expect(rotateRefreshToken(tokenValue)).toBeNull();
  });

  it('rejects wrong current passwords and clears the session on logout', async () => {
    const registerResponse = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: 'Eduardo Costa',
        email: 'eduardo@exemplo.com',
        password: 'SenhaSegura123',
      })
      .set('Origin', 'http://localhost:5173');

    const accessCookies = Array.isArray(registerResponse.headers['set-cookie'])
      ? registerResponse.headers['set-cookie']
      : registerResponse.headers['set-cookie']
        ? [registerResponse.headers['set-cookie']]
        : [];

    const wrongPassword = await request(app)
      .patch('/api/v1/me/password')
      .set('Cookie', accessCookies)
      .set('Origin', 'http://localhost:5173')
      .send({
        currentPassword: 'SenhaErrada123',
        newPassword: 'NovaSenha123',
      });

    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body.error.code).toBe('WRONG_CURRENT_PASSWORD');

    const samePassword = await request(app)
      .patch('/api/v1/me/password')
      .set('Cookie', accessCookies)
      .set('Origin', 'http://localhost:5173')
      .send({
        currentPassword: 'SenhaSegura123',
        newPassword: 'SenhaSegura123',
      });

    expect(samePassword.status).toBe(401);
    expect(samePassword.body.error.code).toBe('SAME_PASSWORD');

    const logoutResponse = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', accessCookies)
      .set('Origin', 'http://localhost:5173');

    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.body.success).toBe(true);
  });

  it('covers authorization middleware edge cases and validation/refresh failures', async () => {
    const nodeUser = createUserRecord({
      name: 'Fábio Reis',
      email: 'fabio@exemplo.com',
      passwordHash: 'hashed',
      role: Role.CLIENT,
    });
    const reqNoToken = { headers: {}, cookies: {} } as Record<string, unknown>;
    const nextNoToken = jest.fn();
    requireAuth(reqNoToken as never, {} as never, nextNoToken);
    expect(nextNoToken).toHaveBeenCalledWith(expect.objectContaining({ code: 'AUTH_REQUIRED' }));

    const invalidReq = { headers: { authorization: 'Bearer invalid-token' }, cookies: {} } as Record<string, unknown>;
    const invalidNext = jest.fn();
    requireAuth(invalidReq as never, {} as never, invalidNext);
    expect(invalidNext).toHaveBeenCalledWith(expect.objectContaining({ code: 'INVALID_ACCESS_TOKEN' }));

    const userReq = { headers: { authorization: `Bearer ${signAccessToken(nodeUser)}` }, cookies: {} } as Record<string, unknown>;
    const userNext = jest.fn();
    requireAuth(userReq as never, {} as never, userNext);
    expect((userReq as { user?: unknown }).user).toEqual(expect.objectContaining({ id: nodeUser.id, role: Role.CLIENT }));

    const roleReq = { user: nodeUser } as Record<string, unknown>;
    const roleNext = jest.fn();
    requireRole(Role.TECHNICIAN)(roleReq as never, {} as never, roleNext);
    expect(roleNext).toHaveBeenCalledWith(expect.objectContaining({ code: 'FORBIDDEN' }));

    const missingUserReq = {
      headers: { authorization: `Bearer ${signAccessToken({ id: 999999, role: Role.CLIENT })}` },
      cookies: {},
    } as Record<string, unknown>;
    const missingUserNext = jest.fn();
    requireAuth(missingUserReq as never, {} as never, missingUserNext);
    expect(missingUserNext).toHaveBeenCalledWith(expect.objectContaining({ code: 'AUTH_REQUIRED' }));

    const disabledUser = createUserRecord({
      name: 'Guilherme Lima',
      email: 'guilherme@exemplo.com',
      passwordHash: 'hash',
      role: Role.CLIENT,
    });
    disabledUser.isActive = false;
    const disabledReq = {
      headers: { authorization: `Bearer ${signAccessToken(disabledUser)}` },
      cookies: {},
    } as Record<string, unknown>;
    const disabledNext = jest.fn();
    requireAuth(disabledReq as never, {} as never, disabledNext);
    expect(disabledNext).toHaveBeenCalledWith(expect.objectContaining({ code: 'ACCOUNT_DISABLED' }));

    const missingRoleReq = {} as Record<string, unknown>;
    const missingRoleNext = jest.fn();
    requireRole(Role.CLIENT)(missingRoleReq as never, {} as never, missingRoleNext);
    expect(missingRoleNext).toHaveBeenCalledWith(expect.objectContaining({ code: 'AUTH_REQUIRED' }));

    const invalidRegistration = await request(app)
      .post('/api/v1/auth/register')
      .send({
        name: '',
        email: 'invalido',
        password: '123',
      })
      .set('Origin', 'http://localhost:5173');

    expect(invalidRegistration.status).toBe(400);
    expect(invalidRegistration.body.error.code).toBe('VALIDATION_ERROR');

    const invalidRefresh = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Origin', 'http://localhost:5173');

    expect(invalidRefresh.status).toBe(401);
    expect(invalidRefresh.body.error.code).toBe('AUTH_REQUIRED');

    const invalidRefreshToken = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', ['refresh_token=fake-value'])
      .set('Origin', 'http://localhost:5173');

    expect(invalidRefreshToken.status).toBe(401);
    expect(invalidRefreshToken.body.error.code).toBe('INVALID_REFRESH_TOKEN');
  });
});
