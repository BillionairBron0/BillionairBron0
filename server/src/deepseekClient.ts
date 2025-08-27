export async function enrichWithAI(text:string){
	return { sentiment:'neutral', summary:text.slice(0,120) };
}

interface DeepSeekConfig { apiKey?:string }
export class DeepSeekClient {
	apiKey?:string;
	constructor(cfg:DeepSeekConfig){ this.apiKey = cfg.apiKey || process.env.DEEPSEEK_KEY; }
	async classifySignalContext(payload:any){
		// Simulated enrichment: compute simple volatility/ momentum tags
		const bars = payload.bars || 0; const price = payload.price || 0;
		const volatilityTag = bars>40 ? 'established_trend' : 'forming';
		const priceBracket = price>50000 ? 'high' : price>20000 ? 'mid' : 'low';
		return { label:`${volatilityTag}_${priceBracket}`, details: payload };
	}
}