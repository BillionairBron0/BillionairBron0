import { aggregate, scoreHeadline } from '../intel/sentimentAdapter.js';
import { broadcastActionable } from '../notify/push.js';
import { WebSocketServer } from 'ws';

let wssRef; export function attachWSS(wss){ wssRef = wss; }

const sources = [
  () => [
    'Tech stocks surge on AI optimism',
    'Energy sector faces decline amid policy shift',
    'Carbon capture growth beats expectations'
  ]
];

function emit(topic) {
  if (!wssRef) return;
  const data = JSON.stringify([{ type:'infoDiagnostics', message: topic }]);
  for (const c of wssRef.clients) if (c.readyState===1) c.send(data);
}

export async function runNewsLoop() {
  try {
    const headlines = sources.flatMap(fn => fn());
    const sentiment = aggregate(headlines);
    emit(`sentiment avg=${sentiment.avg.toFixed(2)}`);
    // Optionally trigger push for extreme sentiment
    if (sentiment.avg >= 2) await broadcastActionable({ side:'LONG', symbol:'NEWS', price:0, type:'actionableSignal' });
  } catch (e) { /* ignore */ }
  setTimeout(runNewsLoop, 300000).unref();
}