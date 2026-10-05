import request from 'supertest';
import app from '../src/app';

describe('Health endpoint', () => {
  it('returns 200 and a healthy payload', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual(
      expect.objectContaining({
        ok: true,
        uptimeSeconds: expect.any(Number),
      }),
    );
  });
});
