import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTransaction, listTransactions } from '../../src/lib/db/transactions';
import { cleanup, createTestUser } from './helpers';

const users: number[] = [];
after(() => cleanup(users));

const base = { txnType: 'expense' as const, txnDate: '2026-10-01', category: 'Misc' };
const filter = { limit: 50 };

test('full-text search matches word stems and quoted phrases (FR-13)', async () => {
  const u = await createTestUser();
  users.push(u);
  await createTransaction(u, { ...base, amount: 455.28, category: 'Health', description: 'Apollo Pharmacies Koramangala' });
  await createTransaction(u, { ...base, amount: 2000, category: 'Fuel', description: 'Indian Oil petrol pump' });
  await createTransaction(u, { ...base, amount: 300, category: 'Food', description: 'Oil and spices from the market' });

  const stem = await listTransactions(u, { ...filter, search: 'pharmacy' });
  assert.deepEqual(stem.map((t) => t.description), ['Apollo Pharmacies Koramangala']);

  const phrase = await listTransactions(u, { ...filter, search: '"indian oil"' });
  assert.deepEqual(phrase.map((t) => t.description), ['Indian Oil petrol pump']);

  const category = await listTransactions(u, { ...filter, search: 'fuel' });
  assert.equal(category.length, 1);
});

test("search never returns another user's transactions (SR-05)", async () => {
  const a = await createTestUser();
  const b = await createTestUser();
  users.push(a, b);
  await createTransaction(a, { ...base, amount: 99, description: 'Secret Pharmacy' });

 assert.equal((await listTransactions(b, { ...filter, search: 'pharmacy' })).length, 0);
});
