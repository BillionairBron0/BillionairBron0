import axios from 'axios';
import type { WebSocketServer } from 'ws';
let wss: WebSocketServer | null = null;

export async function pollNews(){
	try {
		const { data } = await axios.get('https://hn.algolia.com/api/v1/search?tags=front_page');
		return (data.hits||[]).slice(0,5).map((h:any)=>({ id:h.objectID, headline:h.title, url:h.url, sentiment:0 }));
	} catch { return []; }
}

export function attachWSS(server: WebSocketServer){ wss = server; }

export async function runNewsLoop(){
	const news = await pollNews();
	if(wss){ const payload = JSON.stringify([{ type:'newsBatch', news }]); wss.clients.forEach((c:any)=>{ if(c.readyState===1) c.send(payload); }); }
	setTimeout(runNewsLoop, 300_000); // 5m
}