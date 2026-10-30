import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { applyRuleToExisting, categorize, createRule, deleteRule, listRules } from '../../src/lib/db/rules';
import { createTransaction, listTransactions } from '../../src/lib/db/transactions';
import { cleanup, createTestUser } from './helpers';

const users: number[] = [];
after(() => cleanup(users));

test('system rules categorise common merchants; unknown stays Uncategorized', async () => {
  const u = await createTestUser();
  users.push(u);
  assert.equal((await categorize(u, 'UPI/SWIGGY/ORDER 123')).category, 'Food');
  assert.equal((await categorize(u, 'POS BIG BAZAAR KORAMANGALA')).category, 'Groceries');
  assert.equal((await categorize(u, 'ACME WIDGETS LTD')).category, 'Uncategorized');
});

test("a user's own rule beats the system rule only for that user (FR-15)", async () => {
  const a = await createTestUser();
  const b = await createTestUser();
  users.push(a, b);
  await createRule(a, { keyword: 'amazon', category: 'Business Expense', txnType: 'expense' });
  assert.equal((await categorize(a, 'AMAZON PAY INDIA')).category, 'Business Expense');
  assert.equal((await categorize(b, 'AMAZON PAY INDIA')).category, 'Shopping');
});

test('adding a rule re-categorises existing matching transactions', async () => {
  const u = await createTestUser();
  users.push(u);
  await createTransaction(u, { txnType: 'expense', amount: 500, txnDate: '2026-10-02', category: 'Uncategorized', description: 'Payment to CULT FIT' });
  const rule = await createRule(u, { keyword: 'cult fit', category: 'Fitness', txnType: 'expense' });
  assert.equal(await applyRuleToExisting(u, rule), 1);
  const [t] = await listTransactions(u, { limit: 10 });
  assert.equal(t.category, 'Fitness');
});

test('system rules cannot be deleted by a user', async () => {
  const u = await createTestUser();
  users.push(u);
  const system = (await listRules(u)).find((r) => r.isSystem)!;
  await assert.rejects(deleteRule(u, system.id), /system rule/);
});
