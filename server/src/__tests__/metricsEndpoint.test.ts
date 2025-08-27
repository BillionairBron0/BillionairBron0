import request from 'supertest';
import { app } from '../index';

describe('GET /metrics', () => {
  test('returns ingest metrics shape', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.body.ingest).toBeDefined();
    expect(res.body.ingest).toHaveProperty('bars');
  });
});