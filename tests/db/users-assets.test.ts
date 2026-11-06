import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createUser, findUserByEmail } from '../../src/lib/db/users';
import { createAsset, deleteAsset, getAsset, getValuationHistory, listAssets, updateAsset } from '../../src/lib/db/assets';
import { databaseTime } from '../../src/lib/db/health';
import { createTransaction, deleteTransaction, listTransactions } from '../../src/lib/db/transactions';
import { cleanup, createTestUser } from './helpers';

const users: number[] = [];
after(() => cleanup(users));

test('users: create, find by email, unique email (FR-01)', async () => {
  const email = `u-${randomUUID()}@example.com`;
  const u = await createUser({ name: 'Asha Rao', email, passwordHash: 'x', role: 'advisor' });
  users.push(u.id);
  assert.equal((await findUserByEmail(email))?.role, 'advisor');
  assert.equal(await findUserByEmail(`missing-${randomUUID()}@example.com`), null);
  await assert.rejects(createUser({ name: 'Dup', email, passwordHash: 'x', role: 'individual' }), { code: '23505' });
});

test('health check reads the database time', async () => {
  assert.match(String(await databaseTime()), /^\d{4}-\d{2}-\d{2}/);
});

const GOLD = { name: 'Gold', assetType: 'gold' as const, liquidity: 'liquid' as const, purchaseValue: 100000, currentValue: 100000, purchaseDate: '2024-01-01', valuationDate: '2024-01-01' };

test('assets: revaluation adds history, rename does not; other users get nothing (FR-05, FR-06, SR-05)', async () => {
  const a = await createTestUser();
  const b = await createTestUser();
  users.push(a, b);
  const asset = await createAsset(a, GOLD);

  await updateAsset(a, asset.id, { ...GOLD, name: 'Gold coins' });
  assert.equal((await getValuationHistory(a, asset.id)).length, 1);

  const up = await updateAsset(a, asset.id, { ...GOLD, name: 'Gold coins', currentValue: 125000, valuationDate: '2026-10-01' });
  assert.equal(up?.currentValue, 125000);
  const h = await getValuationHistory(a, asset.id);
  assert.deepEqual(h.map((x) => [x.value, x.source]), [[100000, 'manual-entry'], [125000, 'revaluation']]);

  assert.equal(await getAsset(b, asset.id), null);
  assert.equal(await updateAsset(b, asset.id, GOLD), null);
  assert.deepEqual(await getValuationHistory(b, asset.id), []);
  assert.equal(await deleteAsset(b, asset.id), false);
  assert.equal((await listAssets(a)).length, 1);
  assert.equal(await deleteAsset(a, asset.id), true);
  assert.equal(await getAsset(a, asset.id), null);
});

test('transactions: only the owner can delete (FR-12, SR-05)', async () => {
  const a = await createTestUser();
  const b = await createTestUser();
  users.push(a, b);
  const t = await createTransaction(a, { txnType: 'income', amount: 5000, txnDate: '2026-10-01', category: 'Salary', description: '' });
  assert.equal(t.description, null);
  assert.equal(await deleteTransaction(b, t.id), false);
  assert.equal(await deleteTransaction(a, t.id), true);
  assert.equal((await listTransactions(a, { limit: 10 })).length, 0);
});
