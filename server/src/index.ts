import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import pino from 'pino';
import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage } from 'http';
import rateLimit from 'express-rate-limit';
import { SignalEngine } from './signalEngine';
import { DeepSeekClient } from './deepseekClient';
import { validateEvents } from './eventValidator';
import { persistEvents, recentSignals, paginatedSignals, ensureUser, userVaultSet, userVaultGet, userByToken } from './db';
import axios from 'axios';
import { getBroker, updateBrokerCreds, listBrokers } from './broker/registry';
import { v4 as uuidv4 } from 'uuid';
import { requireToken } from './auth/middleware';
import { requirePro } from './auth/planEnforce';
import { vaultSet, vaultGet } from './auth/vault';
import { addPushToken, broadcastActionable } from './notify/push';
import { recordIngest, getMetrics } from './metrics';
import { runNewsLoop, attachWSS } from './workers/newsWorker';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });
const app = express();
app.use(cors());
app.use(express.json());
app.use(rateLimit({ windowMs: 60_000, max: 120 }));
app.use(express.static('public'));

// Manage per-symbol engines
const engines = new Map<string, SignalEngine>();
function getEngine(symbol: string) {
  if (!engines.has(symbol)) engines.set(symbol, new SignalEngine({}));
  return engines.get(symbol)!;
}
const deepseek = new DeepSeekClient({});

app.get('/health', (_req:Request, res:Response) => res.json({ ok: true }));

app.post('/ingest/bar', async (req:Request, res:Response) => {
  const bar = req.body as any; // {symbol,time,open,high,low,close,volume}
  try {
    const start = Date.now();
    if (!bar.symbol) throw new Error('symbol required');
    const engine = getEngine(bar.symbol);
    const events = engine.ingestBar(bar);
    if (events.length) {
      const failures = validateEvents(events as any);
      if (failures.length) log.warn({ failures }, 'validation issues');
      await persistEvents(events.map(e => ({ ...e, symbol: bar.symbol })) as any);
      broadcast(events.map(e => ({ ...e, symbol: bar.symbol })));
      for (const e of events) if (e.type==='actionableSignal') await broadcastActionable({ ...e, symbol: bar.symbol } as any);
    }
    recordIngest(start, events as any);
    res.json({ accepted: true, events });
  } catch (e:any) {
    log.error(e, 'ingest error');
    res.status(400).json({ error: e.message });
  }
});

app.post('/config/:symbol', (req:Request, res:Response) => {
  const symbol = req.params.symbol;
  const engine = getEngine(symbol);
  engine.updateConfig(req.body || {});
  res.json({ updated: true, symbol, config: engine.getConfig() });
});

app.get('/signals/recent', requireToken, async (_req:Request, res:Response) => {
  res.json({ signals: await recentSignals(100) });
});
app.get('/signals/page', requireToken, async (req:Request, res:Response) => {
  const limit = parseInt((req.query.limit as string)||'50',10);
  const offset = parseInt((req.query.offset as string)||'0',10);
  res.json({ signals: await paginatedSignals({ limit, offset }), limit, offset });
});

// Post-analysis enrichment using DeepSeek (prototype)
app.post('/analyze/latest/:symbol', async (req:Request, res:Response) => {
  try {
    const engine = getEngine(req.params.symbol);
    const hist = engine.state.history.slice(-50);
    const latest = hist[hist.length - 1];
    const payload = { symbol: req.params.symbol, price: latest?.close, bars: hist.length };
    const ai = await deepseek.classifySignalContext(payload);
    res.json({ ok: true, ai });
  } catch (e:any) { res.status(500).json({ error: e.message }); }
});

// Simple crypto price poller (free public API - coingecko)
const tracked = (process.env.SYMBOLS || 'BTCUSDT,ETHUSDT').split(',');
async function pollCrypto() {
  try {
    for (const sym of tracked) {
      const pair = sym.toUpperCase();
      const resp = await axios.get(`https://api.binance.com/api/v3/klines?symbol=${pair}&interval=1m&limit=1`);
      const k = resp.data[0];
      const bar = { symbol: pair, time: new Date(k[0]).toISOString(), open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5] };
      const engine = getEngine(pair);
      const start = Date.now();
      const events = engine.ingestBar(bar);
      if (events.length) {
        const failures = validateEvents(events as any);
        if (failures.length) log.warn({ failures }, 'validation issues');
        await persistEvents(events.map(e => ({ ...e, symbol: pair })) as any);
        broadcast(events.map(e => ({ ...e, symbol: pair })));
        for (const e of events) if (e.type==='actionableSignal') await broadcastActionable({ ...e, symbol: pair } as any);
      }
      recordIngest(start, events as any);
    }
  } catch (err:any) { log.warn({ err: err.message }, 'poll error'); }
  finally { setTimeout(pollCrypto, 60_000); }
}
if (process.env.AUTO_POLL === '1') pollCrypto();

const server = app.listen(process.env.PORT || 4000, () => {
  log.info({ port: (server.address() as any).port }, 'server listening');
  if (process.env.ENABLE_NEWS_LOOP === '1') runNewsLoop();
});

// WebSocket push for real-time events
const wss = new WebSocketServer({ server, path: '/stream', perMessageDeflate: { zlibDeflateOptions: { level: 3 } } });
attachWSS(wss as any);
function broadcast(payload: any) {
  const data = JSON.stringify(payload);
  wss.clients.forEach((c: any) => { if (c.readyState === WebSocket.OPEN && !c.closedByAuth) c.send(data); });
}

wss.on('connection', async (ws: WebSocket & { closedByAuth?:boolean; user?:any }, req: IncomingMessage) => {
  try {
    const url = new URL(req.url || '', 'http://localhost');
    const token = url.searchParams.get('token');
    let user:any = null;
    if (token) {
      if (process.env.API_TOKEN && token === process.env.API_TOKEN) {
        user = { id: 'admin', plan: 'PRO' };
      } else {
        user = await userByToken(token);
      }
    }
    if (!user) {
      ws.send(JSON.stringify([{ type:'infoDiagnostics', message:'unauthorized: missing or invalid token' }]));
      ws.close(4001, 'unauthorized');
      ws.closedByAuth = true; return;
    }
    if (process.env.REQUIRE_PRO_STREAM === '1' && user.plan !== 'PRO') {
      ws.send(JSON.stringify([{ type:'infoDiagnostics', message:'upgrade_required_for_stream' }]));
      ws.close(4003, 'plan_required');
      ws.closedByAuth = true; return;
    }
    ws.user = user;
    ws.send(JSON.stringify([{ type: 'infoDiagnostics', message: 'connected', plan: user.plan }]));
  } catch (e) {
    ws.send(JSON.stringify([{ type:'infoDiagnostics', message:'auth_error' }]));
    ws.close(4002, 'auth_error');
    ws.closedByAuth = true;
  }
});

// Broker endpoints
app.get('/brokers', requireToken, (_req:Request, res:Response) => res.json({ brokers: listBrokers() }));
app.post('/brokers/:name/creds', requireToken, (req:Request, res:Response) => {
  try { const out = updateBrokerCreds(req.params.name, req.body); res.json({ updated: true, out }); } catch (e:any) { res.status(400).json({ error: e.message }); }
});
app.get('/brokers/:name/account', requireToken, async (req:Request, res:Response) => {
  try { const b = getBroker(req.params.name); const acct = await b.account(); res.json({ account: acct }); } catch (e:any) { res.status(400).json({ error: e.message }); }
});
app.post('/brokers/:name/order', requireToken, requirePro, async (req:Request, res:Response) => {
  try {
    const b = getBroker(req.params.name);
    const { symbol, qty, side } = req.body;
    const o = await b.placeOrder({ symbol, qty, side, client_order_id: uuidv4() });
    res.json({ order: o });
  } catch (e:any) { res.status(400).json({ error: e.message }); }
});

// Vault endpoints
app.post('/vault/:key', requireToken, async (req:Request, res:Response) => { await vaultSet(req.params.key, req.body); res.json({ stored:true }); });
app.get('/vault/:key', requireToken, async (req:Request, res:Response) => { res.json({ value: await vaultGet(req.params.key) }); });

// User management
app.post('/users', async (req:Request, res:Response) => {
  const { id, apiToken, plan } = req.body || {};
  if (!id || !apiToken) return res.status(400).json({ error:'id and apiToken required'});
  await ensureUser(id, apiToken, plan || 'FREE');
  res.json({ created:true });
});
app.post('/users/vault/:key', requireToken, async (req:any, res:Response) => {
  if (!req.user) return res.status(401).json({ error:'unauthorized'});
  await userVaultSet(req.user.id, req.params.key, JSON.stringify(req.body));
  res.json({ stored:true });
});
app.get('/users/vault/:key', requireToken, async (req:any, res:Response) => {
  if (!req.user) return res.status(401).json({ error:'unauthorized'});
  const v = await userVaultGet(req.user.id, req.params.key);
  res.json({ value: v ? JSON.parse(v) : null });
});

app.get('/subscribe', (_req:Request, res:Response) => {
  res.json({ url: process.env.STRIPE_SUBSCRIPTION_URL || 'https://buy.stripe.com/aFa6oGcs4a1w4VfeQZaVa00' });
});

app.post('/push/token', (req:Request, res:Response) => { const { token } = req.body || {}; if (!token) return res.status(400).json({ error:'token required'}); addPushToken(token); res.json({ registered:true }); });

app.get('/metrics', (_req:Request, res:Response) => res.json(getMetrics()));

export { app, server };
