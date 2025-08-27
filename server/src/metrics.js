const metrics = {
  barsIngested: 0,
  actionableSignals: 0,
  watchOpens: 0,
  avgLatencyMs: 0,
  samples: 0
};

export function recordIngest(start, events) {
  const dur = Date.now() - start;
  metrics.samples++;
  metrics.avgLatencyMs = ((metrics.avgLatencyMs * (metrics.samples-1)) + dur) / metrics.samples;
  metrics.barsIngested++;
  for (const e of events) {
    if (e.type==='actionableSignal') metrics.actionableSignals++;
    if (e.type==='watchOpportunity' && e.barsSinceLeading===0) metrics.watchOpens++;
  }
}

export function getMetrics() { return { ...metrics }; }

setInterval(()=> {
  // eslint-disable-next-line no-console
  console.log('[metrics]', JSON.stringify(metrics));
}, 60000).unref();