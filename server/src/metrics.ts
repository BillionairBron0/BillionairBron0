// Temporary TypeScript conversion shim for metrics
interface Latency { p50:number; p95:number; samples:number[] }
const ingest = { bars:0, events:0, lastLatencyMs:0, latency: { p50:0, p95:0, samples:[] } as Latency };

function updateLatency(lat:number){
	const l=ingest.latency; l.samples.push(lat); if(l.samples.length>200) l.samples.shift();
	const sorted=[...l.samples].sort((a,b)=>a-b); const p=(pct:number)=>sorted[Math.min(sorted.length-1, Math.floor(pct*(sorted.length-1)))];
	l.p50=p(0.50); l.p95=p(0.95);
	l.p50=Number(l.p50.toFixed(2)); l.p95=Number(l.p95.toFixed(2));
}

export function recordIngest(start:number, events:any[]){
	ingest.bars += 1; ingest.events += events.length; const lat = Date.now() - start; ingest.lastLatencyMs = lat; updateLatency(lat);
}
export function getMetrics(){ return { ingest }; }