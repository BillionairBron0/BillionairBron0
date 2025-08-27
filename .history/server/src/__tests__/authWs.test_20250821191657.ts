import WebSocket from 'ws';
import request from 'supertest';
import { app } from '../index';
import type { Server } from 'http';

describe('WebSocket auth & plan gating', () => {
  let server: Server; let port = 0;
  beforeAll((done: jest.DoneCallback) => {
    process.env.API_TOKEN = '';
    server = app.listen(0, () => { port = (server.address() as any).port; done(); });
  });
  afterAll((done: jest.DoneCallback) => { delete process.env.API_TOKEN; server.close(done); });

  test('rejects without token when API_TOKEN set', (done: jest.DoneCallback) => {
    process.env.API_TOKEN = 'secret';
    const ws = new WebSocket(`ws://localhost:${port}/stream`);
    ws.once('close', (code: number) => { expect(code).toBe(4001); delete process.env.API_TOKEN; done(); });
  });

  test('broker order route requires PRO', async () => {
    process.env.API_TOKEN = '';
    const res = await request(app)
      .post('/brokers/alpaca/order')
      .set('x-user-plan','FREE')
      .send({ symbol:'BTCUSD', side:'buy', qty:1 });
    expect(res.status).toBe(402);
  });
});
