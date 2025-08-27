import sqlite3 from 'sqlite3';
// @ts-ignore - sqlite has no esm types for open
import { open } from 'sqlite';

let connPromise: Promise<any> | undefined;
export async function getDb() {
  if (!connPromise) {
    connPromise = open({ filename: process.env.DB_FILE || 'signals.db', driver: sqlite3.Database });
    const db = await connPromise;
    await db.exec(`CREATE TABLE IF NOT EXISTS signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      time TEXT,
      side TEXT,
      type TEXT,
      price REAL,
      confluence REAL,
      payload TEXT
    );`);
    await db.exec(`CREATE TABLE IF NOT EXISTS vault_secrets (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );`);
    await db.exec(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      api_token TEXT UNIQUE,
      plan TEXT DEFAULT 'FREE'
    );`);
    await db.exec(`CREATE TABLE IF NOT EXISTS user_vault (
      user_id TEXT,
      key TEXT,
      value TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, key)
    );`);
  }
  return connPromise;
}

export async function persistEvents(events: any[]) {
  const db = await getDb();
  const stmt = await db.prepare('INSERT INTO signals (time, side, type, price, confluence, payload) VALUES (?,?,?,?,?,?)');
  try {
    await db.exec('BEGIN');
    for (const e of events) {
      if (['actionableSignal','watchOpportunity'].includes(e.type)) {
        await stmt.run(e.time || new Date().toISOString(), e.side || null, e.type, e.price || null, e.confluenceScore || null, JSON.stringify(e));
      }
    }
    await db.exec('COMMIT');
  } catch (err) {
    await db.exec('ROLLBACK');
    // eslint-disable-next-line no-console
    console.error('persistEvents error', err);
  } finally {
    await stmt.finalize();
  }
}

export async function recentSignals(limit=50) { const db = await getDb(); return db.all('SELECT * FROM signals ORDER BY id DESC LIMIT ?', limit); }
export async function paginatedSignals({ limit=50, offset=0 }: { limit?:number; offset?:number }) { const db = await getDb(); return db.all('SELECT * FROM signals ORDER BY id DESC LIMIT ? OFFSET ?', limit, offset); }
export async function vaultSetPersistent(key:string, value:string){ const db=await getDb(); await db.run('INSERT INTO vault_secrets (key,value,updated_at) VALUES (?,?,CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP', key, value); }
export async function vaultGetPersistent(key:string){ const db=await getDb(); const row= await db.get('SELECT value FROM vault_secrets WHERE key=?', key); return row?.value || null; }
export async function ensureUser(id:string, token:string, plan='FREE'){ const db=await getDb(); await db.run('INSERT INTO users (id, api_token, plan) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET plan=excluded.plan', id, token, plan); }
export async function userByToken(token:string){ const db=await getDb(); return db.get('SELECT * FROM users WHERE api_token=?', token); }
export async function userVaultSet(userId:string, key:string, value:string){ const db=await getDb(); await db.run('INSERT INTO user_vault (user_id,key,value,updated_at) VALUES (?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(user_id,key) DO UPDATE SET value=excluded.value, updated_at=CURRENT_TIMESTAMP', userId, key, value); }
export async function userVaultGet(userId:string, key:string){ const db=await getDb(); const row = await db.get('SELECT value FROM user_vault WHERE user_id=? AND key=?', userId, key); return row?.value || null; }