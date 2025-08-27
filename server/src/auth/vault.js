import crypto from 'crypto';
import { vaultSetPersistent, vaultGetPersistent } from '../db.js';

const KEY = (process.env.VAULT_KEY || 'devkey').padEnd(32,'0').slice(0,32);
const iv = Buffer.alloc(16,0);

function enc(data) {
  const cipher = crypto.createCipheriv('aes-256-cbc', KEY, iv);
  let out = cipher.update(JSON.stringify(data), 'utf8','base64');
  out += cipher.final('base64');
  return out;
}
function dec(txt) {
  const decipher = crypto.createDecipheriv('aes-256-cbc', KEY, iv);
  let out = decipher.update(txt,'base64','utf8'); out += decipher.final('utf8');
  return JSON.parse(out);
}

export async function vaultSet(key, value) { await vaultSetPersistent(key, enc(value)); }
export async function vaultGet(key) { const v = await vaultGetPersistent(key); return v?dec(v):null; }