import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { commitImport, listBatches, previewImport } from '../../src/lib/db/imports';
import { parseStatement } from '../../src/lib/services/csv-parser';
import { query } from '../../src/lib/db/postgres';
import { cleanup, createTestUser } from './helpers';

const users: number[] = [];
after(() => cleanup(users));

const CSV = `Date,Narration,Withdrawal Amt.,Deposit Amt.
01/10/26,SALARY OCT ACME TECH,,"1,65,000.00"
03/10/26,UPI/SWIGGY/ORDER 991,455.28,
05/10/26,BESCOM ELECTRICITY,"1,240.00",
`;

async function importOnce(userId: number) {
  const s = parseStatement('hdfc.csv', CSV);
  const preview = await previewImport(userId, s);
  const rows = preview.filter((r) => !r.duplicate).map(({ txnDate, description, amount, txnType, category }) => ({ txnDate, description, amount, txnType, category }));
  return { preview, result: rows.length ? await commitImport(userId, { fileName: 'hdfc.csv', bank: s.bank, rows }) : null };
}

test('preview suggests categories and saves nothing (FR-14)', async () => {
  const u = await createTestUser();
  users.push(u);
  const s = parseStatement('hdfc.csv', CSV);
  const preview = await previewImport(u, s);
  assert.equal(preview.find((r) => r.description.includes('SWIGGY'))?.category, 'Food');
  const count = await query('SELECT count(*)::int AS n FROM transactions WHERE user_id = $1', [u]);
  assert.equal(count[0].n, 0);
});

test('importing the same statement twice adds nothing the second time', async () => {
  const u = await createTestUser();
  users.push(u);
  const first = await importOnce(u);
  assert.equal(first.result?.inserted, 3);
  const second = await importOnce(u);
  assert.equal(second.preview.every((r) => r.duplicate), true);
  // even if the client sends the rows again, the unique index skips them
  const forced = await commitImport(u, { fileName: 'hdfc.csv', bank: 'HDFC', rows: second.preview.map(({ txnDate, description, amount, txnType, category }) => ({ txnDate, description, amount, txnType, category })) });
  assert.deepEqual([forced.inserted, forced.duplicates], [0, 3]);
  const batches = await listBatches(u);
  assert.equal(batches.length, 2);
});

test('a failing row rolls back the whole batch (NFR-03)', async () => {
  const u = await createTestUser();
  users.push(u);
  await assert.rejects(commitImport(u, {
    fileName: 'bad.csv', bank: 'Other',
    rows: [
      { txnDate: '2026-10-01', description: 'GOOD ROW', amount: 10, txnType: 'expense', category: 'Food' },
      { txnDate: '2026-10-02', description: 'BAD ROW', amount: -5, txnType: 'expense', category: 'Food' },
    ],
  }));
  const n = await query('SELECT count(*)::int AS n FROM transactions WHERE user_id = $1', [u]);
  const b = await query('SELECT count(*)::int AS n FROM import_batches WHERE user_id = $1', [u]);
  assert.deepEqual([n[0].n, b[0].n], [0, 0]);
});

test("one user's import does not mark another user's rows as duplicates", async () => {
  const a = await createTestUser();
  const b = await createTestUser();
  users.push(a, b);
  await importOnce(a);
  const forB = await importOnce(b);
  assert.equal(forB.result?.inserted, 3);
});
