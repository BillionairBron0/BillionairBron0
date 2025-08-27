import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pino from 'pino';
import { WebSocketServer } from 'ws';
import rateLimit from 'express-rate-limit';
import { SignalEngine } from './signalEngine.js';
import { DeepSeekClient } from './deepseekClient.js';
import { validateEvents } from './eventValidator.js';
import { persistEvents, recentSignals, paginatedSignals } from './db.js';
import axios from 'axios';
import { getBroker, updateBrokerCreds, listBrokers } from './broker/registry.js';
import { v4 as uuidv4 } from 'uuid';
import { requireToken } from './auth/middleware.js';
import { requirePro } from './auth/planEnforce.js';
import { vaultSet, vaultGet } from './auth/vault.js';
import { ensureUser, userVaultSet, userVaultGet, userByToken } from './db.js';
import { addPushToken, broadcastActionable } from './notify/push.js';
import { recordIngest, getMetrics } from './metrics.js';
import { attachWSS, runNewsLoop } from './workers/newsWorker.js';

const log = pino({ level: process.env.LOG_LEVEL || 'info' });
const app = express();
app.use(cors());
app.use(express.json());
app.use(rateLimit({ windowMs: 60_000, max: 120 }));

// Manage per-symbol engines
const engines = new Map();
function getEngine(symbol) {
  if (!engines.has(symbol)) engines.set(symbol, new SignalEngine({}));
  return engines.get(symbol);
}
const deepseek = new DeepSeekClient({});

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/ingest/bar', async (req, res) => {
  const bar = req.body; // {symbol,time,open,high,low,close,volume}
  try {
  const start = Date.now();
    if (!bar.symbol) throw new Error('symbol required');
    const engine = getEngine(bar.symbol);
    const events = engine.ingestBar(bar);
    if (events.length) {
      const failures = validateEvents(events);
      if (failures.length) log.warn({ failures }, 'validation issues');
      await persistEvents(events.map(e => ({ ...e, symbol: bar.symbol })));
      broadcast(events.map(e => ({ ...e, symbol: bar.symbol })));
      for (const e of events) if (e.type==='actionableSignal') await broadcastActionable({ ...e, symbol: bar.symbol });
    }
  recordIngest(start, events);
    res.json({ accepted: true, events });
  } catch (e) {
    log.error(e, 'ingest error');
    res.status(400).json({ error: e.message });
  }
});

app.post('/config/:symbol', (req, res) => {
  const symbol = req.params.symbol;
  const engine = getEngine(symbol);
  engine.updateConfig(req.body || {});
  res.json({ updated: true, symbol, config: engine.getConfig() });
});

app.get('/signals/recent', requireToken, async (_req, res) => {
  res.json({ signals: await recentSignals(100) });
});
app.get('/signals/page', requireToken, async (req, res) => {
  const limit = parseInt(req.query.limit||'50',10);
  const offset = parseInt(req.query.offset||'0',10);
  res.json({ signals: await paginatedSignals({ limit, offset }), limit, offset });
});

// Post-analysis enrichment using DeepSeek (prototype)
app.post('/analyze/latest/:symbol', async (req, res) => {
  try {
    const engine = getEngine(req.params.symbol);
    const hist = engine.state.history.slice(-50);
    const latest = hist[hist.length - 1];
    const payload = { symbol: req.params.symbol, price: latest?.close, bars: hist.length };
    const ai = await deepseek.classifySignalContext(payload);
    res.json({ ok: true, ai });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Simple crypto price poller (free public API - coingecko)
const tracked = (process.env.SYMBOLS || 'BTCUSDT,ETHUSDT').split(',');
async function pollCrypto() {
  try {
    // Use Binance public klines for recent minute
    for (const sym of tracked) {
      const pair = sym.toUpperCase();
      const resp = await axios.get(`https://api.binance.com/api/v3/klines?symbol=${pair}&interval=1m&limit=1`);
      const k = resp.data[0];
      const bar = { symbol: pair, time: new Date(k[0]).toISOString(), open: +k[1], high: +k[2], low: +k[3], close: +k[4], volume: +k[5] };
      const engine = getEngine(pair);
      const start = Date.now();
      const events = engine.ingestBar(bar);
      if (events.length) {
        const failures = validateEvents(events);
        if (failures.length) log.warn({ failures }, 'validation issues');
        await persistEvents(events.map(e => ({ ...e, symbol: pair })));
        broadcast(events.map(e => ({ ...e, symbol: pair })));
        for (const e of events) if (e.type==='actionableSignal') await broadcastActionable({ ...e, symbol: pair });
      }
      recordIngest(start, events);
    }
app.get('/metrics', (_req, res) => res.json(getMetrics()));
  } catch (err) { log.warn({ err: err.message }, 'poll error'); }
  finally { setTimeout(pollCrypto, 60_000); }
}
if (process.env.AUTO_POLL === '1') pollCrypto();

const server = app.listen(process.env.PORT || 4000, () => {
  log.info({ port: server.address().port }, 'server listening');
  if (process.env.ENABLE_NEWS_LOOP === '1') runNewsLoop();
});

// WebSocket push for real-time events
const wss = new WebSocketServer({ server, path: '/stream', perMessageDeflate: { zlibDeflateOptions: { level: 3 } } });
attachWSS(wss);
function broadcast(payload) {
  const data = JSON.stringify(payload);
  wss.clients.forEach(c => { if (c.readyState === 1 && !c.closedByAuth) c.send(data); });
}

wss.on('connection', async (ws, req) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    const token = url.searchParams.get('token');
    let user = null;
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
    // Optional plan enforcement for streaming (set REQUIRE_PRO_STREAM=1 to enforce)
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
app.get('/brokers', requireToken, (_req, res) => res.json({ brokers: listBrokers() }));
app.post('/brokers/:name/creds', requireToken, (req, res) => {
  try { const out = updateBrokerCreds(req.params.name, req.body); res.json({ updated: true, out }); } catch (e) { res.status(400).json({ error: e.message }); }
});
app.get('/brokers/:name/account', requireToken, async (req, res) => {
  try { const b = getBroker(req.params.name); const acct = await b.account(); res.json({ account: acct }); } catch (e) { res.status(400).json({ error: e.message }); }
});
app.post('/brokers/:name/order', requireToken, requirePro, async (req, res) => {
  try {
    const b = getBroker(req.params.name);
    const { symbol, qty, side } = req.body;
    const o = await b.placeOrder({ symbol, qty, side, client_order_id: uuidv4() });
    res.json({ order: o });
  } catch (e) { res.status(400).json({ error: e.message }); }
});

// Vault endpoints (for API keys etc.)
app.post('/vault/:key', requireToken, async (req, res) => { await vaultSet(req.params.key, req.body); res.json({ stored:true }); });
app.get('/vault/:key', requireToken, async (req, res) => { res.json({ value: await vaultGet(req.params.key) }); });

// User management
app.post('/users', async (req, res) => {
  const { id, apiToken, plan } = req.body;
  if (!id || !apiToken) return res.status(400).json({ error:'id and apiToken required'});
  await ensureUser(id, apiToken, plan || 'FREE');
  res.json({ created:true });
});
app.post('/users/vault/:key', requireToken, async (req, res) => {
  if (!req.user) return res.status(401).json({ error:'unauthorized'});
  await userVaultSet(req.user.id, req.params.key, JSON.stringify(req.body));
  res.json({ stored:true });
});
app.get('/users/vault/:key', requireToken, async (req, res) => {
  if (!req.user) return res.status(401).json({ error:'unauthorized'});
  const v = await userVaultGet(req.user.id, req.params.key);
  res.json({ value: v ? JSON.parse(v) : null });
});

// Stripe subscription link (configurable)
app.get('/subscribe', (_req, res) => {
  res.json({ url: process.env.STRIPE_SUBSCRIPTION_URL || 'https://buy.stripe.com/aFa6oGcs4a1w4VfeQZaVa00' });
});

app.post('/push/token', (req, res) => { const { token } = req.body; if (!token) return res.status(400).json({ error:'token required'}); addPushToken(token); res.json({ registered:true }); });
