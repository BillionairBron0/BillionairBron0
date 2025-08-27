import type { Indicator } from '../registry';

export const macdIndicator: Indicator = {
  name: 'MACD',
  compute(state: any){
    const fast=12, slow=26, signal=9; const h=state.history; if(h.length<slow+signal) return { longTrigger:false, shortTrigger:false };
    const closes = h.map((b:any)=>b.close);
    const emaSeries=(period:number)=>{ const k=2/(period+1); let arr:number[]=[]; let ema=closes[0]; for(let i=0;i<closes.length;i++){ ema=i===0?closes[i]:closes[i]*k + ema*(1-k); arr.push(ema);} return arr; };
    const ef=emaSeries(fast), es=emaSeries(slow); const macdLine=ef.map((v,i)=>v-es[i]); const kSig=2/(signal+1); let sigArr:number[]=[]; let s=macdLine[0]; for(let i=0;i<macdLine.length;i++){ s=i===0?macdLine[i]:macdLine[i]*kSig + s*(1-kSig); sigArr.push(s);} const line=macdLine[macdLine.length-1]; const signalLine=sigArr[sigArr.length-1]; return { longTrigger: line>signalLine && line>0, shortTrigger: line<signalLine && line<0, longRationale:`MACD ${line.toFixed(4)} > ${signalLine.toFixed(4)}`, shortRationale:`MACD ${line.toFixed(4)} < ${signalLine.toFixed(4)}`, meta:{ line, signal: signalLine } };
  }
};