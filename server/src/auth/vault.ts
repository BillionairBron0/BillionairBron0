import crypto from 'crypto';
import { vaultSetPersistent, vaultGetPersistent } from '../db';

const KEY = (process.env.VAULT_KEY || 'devkey').padEnd(32,'0').slice(0,32);
const iv = Buffer.alloc(16,0);

function enc(data: any) {
  const cipher = crypto.createCipheriv('aes-256-cbc', KEY, iv);
  let out = cipher.update(JSON.stringify(data), 'utf8','base64');
  out += cipher.final('base64');
  return out;
}
function dec(txt: string) {
  const decipher = crypto.createDecipheriv('aes-256-cbc', KEY, iv);
  let out = decipher.update(txt,'base64','utf8'); out += decipher.final('utf8');
  return JSON.parse(out);
}

export async function vaultSet(key: string, value: any) { await vaultSetPersistent(key, enc(value)); }
export async function vaultGet(key: string) { const v = await vaultGetPersistent(key); return v?dec(v):null; }