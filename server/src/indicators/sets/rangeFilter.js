export const rangeFilterIndicator = {
  name: 'Range Filter',
  compute(state) {
    const h = state.history; if (h.length < 25) return { longTrigger:false, shortTrigger:false };
    const closes = h.slice(-20).map(b=>b.close);
    const mean = closes.reduce((a,b)=>a+b,0)/closes.length;
    const variance = closes.reduce((a,b)=>a+Math.pow(b-mean,2),0)/closes.length;
    const stdev = Math.sqrt(variance); const k=1.5; const last=h[h.length-1].close;
    return {
      longTrigger: last > mean + k*stdev,
      shortTrigger: last < mean - k*stdev,
      longRationale: `close ${last.toFixed(2)} > upper ${(mean+k*stdev).toFixed(2)}`,
      shortRationale: `close ${last.toFixed(2)} < lower ${(mean-k*stdev).toFixed(2)}`,
      meta: { mean, stdev }
    };
  }
};