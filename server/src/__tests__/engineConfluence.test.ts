import { SignalEngine } from '../signalEngine';

function bar(i:number){ const base=100+i*0.5; return { time:new Date(Date.now()+i*60000).toISOString(), open:base, high:base+1, low:base-1, close:base+2 }; }

describe('SignalEngine deterministic MACD path', () => {
  test('produces watch then actionable with MACD leading and no confirmations', () => {
    const engine = new SignalEngine({ confirmationsEnabled:[], minConfluence:0, leadingIndicator:'MACD' } as any);
    const events:any[]=[];
    for(let i=0;i<60;i++){ const ev=engine.ingestBar(bar(i)); events.push(...ev); }
    const watch = events.find(e=>e.type==='watchOpportunity');
    const actionable = events.find(e=>e.type==='actionableSignal');
    expect(watch).toBeTruthy();
    expect(actionable).toBeTruthy();
  });
});