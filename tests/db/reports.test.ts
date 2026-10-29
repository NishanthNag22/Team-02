import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { fyReport } from '../../src/lib/db/reports';
import { createTransaction } from '../../src/lib/db/transactions';
import { createLoan, getSchedule, payInstallment } from '../../src/lib/db/loans';
import { query } from '../../src/lib/db/postgres';
import { cleanup, createTestUser } from './helpers';

const users: number[] = [];
after(() => cleanup(users));

test('31 March and 1 April land in different financial years (AC-22)', async () => {
  const u = await createTestUser();
  users.push(u);
  await createTransaction(u, { txnType: 'expense', amount: 100, txnDate: '2026-03-31', category: 'Food', description: 'last day' });
  await createTransaction(u, { txnType: 'expense', amount: 200, txnDate: '2026-04-01', category: 'Food', description: 'first day' });
  await createTransaction(u, { txnType: 'income', amount: 1000, txnDate: '2026-05-01', category: 'Salary', description: 'pay' });

  const older = await fyReport(u, 2025);
  const newer = await fyReport(u, 2026);
  assert.equal(older.summary.expense, 100);
  assert.equal(newer.summary.expense, 200);
  assert.equal(newer.summary.income, 1000);
  assert.equal(newer.summary.savingsRatePct, 80);
  assert.equal(newer.categories[0].category, 'Food');
});

test('home loan EMIs paid in the FY produce 80C and 24(b) hints', async () => {
  const u = await createTestUser();
  users.push(u);
  const loan = await createLoan(u, { loanType: 'home', lender: 'SBI', principal: 3000000, interestRate: 8.5, interestType: 'floating', tenureMonths: 240, startDate: '2026-03-10' });
  const sched = await getSchedule(u, loan.id);
  for (const r of sched.slice(0, 3)) {
    await payInstallment(u, r.id);
    await query('UPDATE emi_schedule SET paid_date = due_date WHERE id = $1', [r.id]);
  }
  const rep = await fyReport(u, 2026);
  assert.equal(rep.loans[0].emis, 3);
  assert.deepEqual(rep.taxHints.map((h) => h.section), ['80C', '24(b)']);
  assert.ok(rep.taxHints[1].claimable > 0);
});
