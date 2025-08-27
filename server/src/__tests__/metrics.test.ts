import { recordIngest, getMetrics } from '../metrics';

describe('metrics', () => {
  test('records bar and events latency aggregates', () => {
    const start = Date.now() - 5; // pretend it started 5ms earlier
    recordIngest(start, [{},{}]);
    const m = getMetrics();
    expect(m.ingest.bars).toBeGreaterThanOrEqual(1);
    expect(m.ingest.events).toBeGreaterThanOrEqual(2);
    expect(m.ingest.lastLatencyMs).toBeGreaterThanOrEqual(0);
    expect(m.ingest.latency.p50).toBeDefined();
  });
});