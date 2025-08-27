import { SignalEngine } from '../signalEngine.js';

function makeBar(i, base=100) {
  const v = base + i*0.5 + Math.sin(i/3)*2;
  return { symbol:'TEST', time:new Date(1700000000000 + i*60000).toISOString(), open:v-0.2, high:v+0.5, low:v-0.5, close:v, volume:100+i };
}

test('MACD leading triggers eventually', () => {
  const engine = new SignalEngine({ leadingIndicator:'MACD', confirmationsEnabled:[] });
  let actionable=false;
  for (let i=0;i<80;i++) {
    const evts = engine.ingestBar(makeBar(i));
    if (evts.find(e=>e.type==='watchOpportunity') || evts.find(e=>e.type==='actionableSignal')) {
      actionable = true; break;
    }
  }
  expect(actionable).toBe(true);
});

test('Supertrend flip produces watch -> actionable with confirmations', () => {
  const engine = new SignalEngine({ leadingIndicator:'Supertrend', confirmationsEnabled:['EMA200'] });
  let sawAction=false;
  for (let i=0;i<200;i++) {
    const evts = engine.ingestBar(makeBar(i));
    if (evts.find(e=>e.type==='actionableSignal')) { sawAction=true; break; }
  }
  expect(sawAction).toBe(true);
});