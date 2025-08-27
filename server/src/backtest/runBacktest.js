// Basic backtest runner: feed bars from a JSON file into engine and compute stats.
import fs from 'fs';
import { SignalEngine } from '../signalEngine.js';

const file = process.argv[2];
if (!file) { console.error('Usage: node runBacktest.js <bars.json>'); process.exit(1); }
const bars = JSON.parse(fs.readFileSync(file,'utf8'));
const engine = new SignalEngine({ leadingIndicator: process.env.LEADING || 'Supertrend' });
let wins=0, losses=0, lastEntry=null; let pnl=0; const equity=[];
for (const b of bars) {
  const evts = engine.ingestBar(b);
  for (const e of evts) {
    if (e.type==='actionableSignal') {
      // Naive strategy: enter at price, exit after 3 ATR multiples or opposite signal
      if (!lastEntry) lastEntry = { side:e.side, price:e.price, atr:e.risk?.atr || 1 };
      else if (lastEntry.side !== e.side) {
        const diff = e.price - lastEntry.price;
        const r = diff / (lastEntry.atr || 1);
        if ((lastEntry.side==='LONG' && diff>0) || (lastEntry.side==='SHORT' && diff<0)) wins++; else losses++;
        pnl += (lastEntry.side==='LONG'? diff : -diff);
        equity.push(pnl);
        lastEntry = { side:e.side, price:e.price, atr:e.risk?.atr || 1 };
      }
    }
  }
}
if (equity.length===0) equity.push(pnl);
function maxDrawdown(series){
  let peak=-Infinity, dd=0; for (const v of series){ if (v>peak) peak=v; const d=(peak - v); if (d>dd) dd=d; } return dd; }
function sharpe(series){ if (series.length<2) return 0; const rets=[]; for (let i=1;i<series.length;i++) rets.push(series[i]-series[i-1]); const avg=rets.reduce((a,b)=>a+b,0)/rets.length; const stdev=Math.sqrt(rets.reduce((a,b)=>a+Math.pow(b-avg,2),0)/rets.length); return stdev? avg/stdev : 0; }
console.log({ wins, losses, pnl, winRate: wins+losses? wins/(wins+losses):0, maxDrawdown: maxDrawdown(equity), sharpe: sharpe(equity) });