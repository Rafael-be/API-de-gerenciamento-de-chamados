import request from 'supertest';
import app from '../../src/app';

describe('Hardening', () => {
  it('returns a requestId and structured INVALID_JSON for malformed JSON payloads', async () => {
    const response = await request(app)
      .post('/api/v1/auth/login')
      .set('Origin', 'http://localhost:5173')
      .set('Content-Type', 'application/json')
      .send('{"email": "x"');

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('INVALID_JSON');
    expect(response.headers['x-request-id']).toEqual(expect.any(String));
  });

  it('rate-limits repeated auth attempts', async () => {
    const attempts = await Promise.all(
      Array.from({ length: 16 }, (_, index) =>
        request(app)
          .post('/api/v1/auth/login')
          .set('Origin', 'http://localhost:5173')
          .set('Content-Type', 'application/json')
          .send({ email: `user${index}@example.com`, password: 'wrongpass' }),
      ),
    );

    expect(attempts.some((response) => response.status === 429)).toBe(true);
    expect(attempts.find((response) => response.status === 429)?.body.error.code).toBe('RATE_LIMITED');
  });
});
