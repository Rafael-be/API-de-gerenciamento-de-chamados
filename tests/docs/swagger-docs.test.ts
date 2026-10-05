import request from 'supertest';
import app from '../../src/app';

describe('Swagger docs', () => {
  it('exposes OpenAPI metadata and a documented health endpoint', async () => {
    const response = await request(app)
      .get('/api/docs')
      .set('Origin', 'http://localhost:5173');

    expect(response.status).toBe(200);
    expect(response.body.openapi).toBe('3.0.0');
    expect(response.body.info.title).toBe('Helpdesk API');
    expect(response.body.paths['/health']).toBeDefined();
  });
});
