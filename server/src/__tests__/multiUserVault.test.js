import { userVaultSet, userVaultGet, ensureUser } from '../db.js';
import { randomBytes } from 'crypto';

describe('multi-user vault isolation', () => {
  const u1 = 'user_'+randomBytes(4).toString('hex');
  const u2 = 'user_'+randomBytes(4).toString('hex');
  beforeAll(async () => {
    await ensureUser(u1, 'tok_'+u1, 'FREE');
    await ensureUser(u2, 'tok_'+u2, 'PRO');
  });
  test('values are isolated', async () => {
    await userVaultSet(u1, 'alpaca', JSON.stringify({ key:'k1'}));
    await userVaultSet(u2, 'alpaca', JSON.stringify({ key:'k2'}));
    const v1 = await userVaultGet(u1, 'alpaca');
    const v2 = await userVaultGet(u2, 'alpaca');
    expect(JSON.parse(v1).key).toBe('k1');
    expect(JSON.parse(v2).key).toBe('k2');
  });
});
