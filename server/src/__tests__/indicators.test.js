import { SignalEngine } from '../signalEngine.js';
import { vaultSet, vaultGet } from '../auth/vault.js';

function bar(i){
  const base=100; const v= base + Math.sin(i/5)*5 + i*0.2;
  return { symbol:'T', time:new Date(1700000000000 + i*60000).toISOString(), open:v-0.3, high:v+0.6, low:v-0.6, close:v, volume: 100+i };
}

test('Range Filter triggers both directions over time', () => {
  const e = new SignalEngine({ leadingIndicator:'Range Filter', confirmationsEnabled:[] });
  let long=false, short=false;
  for (let i=0;i<120;i++) {
    const evts = e.ingestBar(bar(i));
    if (evts.some(x=>x.type==='watchOpportunity' && x.side==='LONG')) long=true;
    if (evts.some(x=>x.type==='watchOpportunity' && x.side==='SHORT')) short=true;
    if (long && short) break;
  }
  expect(long).toBe(true); expect(short).toBe(true);
});

test('Vault encryption round-trip', async () => {
  const secret = { apiKey:'abc', secret:'xyz' };
  await vaultSet('test', secret);
  const out = await vaultGet('test');
  expect(out).toEqual(secret);
});