import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { currentScore } from '../../src/lib/db/credit-score';
import { createLoan, getSchedule, payInstallment } from '../../src/lib/db/loans';
import { query } from '../../src/lib/db/postgres';
import { cleanup, createTestUser } from './helpers';

const users: number[] = [];
after(() => cleanup(users));

test('score is 300–900 with 5 factors and the disclaimer (FR-19)', async () => {
  const u = await createTestUser();
  users.push(u);
  const s = await currentScore(u);
  assert.ok(s.score >= 300 && s.score <= 900);
  assert.equal(s.factors.length, 5);
  assert.match(s.disclaimer, /not a CIBIL, Experian or Equifax/);
});

test('an overdue installment lowers the score; reading twice adds no history row (AC-19)', async () => {
  const u = await createTestUser();
  users.push(u);
  const today = new Date();
  const start = new Date(Date.UTC(today.getUTCFullYear() - 1, today.getUTCMonth(), 1)).toISOString().slice(0, 10);
  const loan = await createLoan(u, { loanType: 'vehicle', lender: 'Kotak', principal: 600000, interestRate: 9.5, interestType: 'fixed', tenureMonths: 60, startDate: start });
  const sched = await getSchedule(u, loan.id);
  const due = sched.filter((r) => r.dueDate < today.toISOString().slice(0, 10));
  for (const r of due) {
    await payInstallment(u, r.id);
    await query('UPDATE emi_schedule SET paid_date = due_date WHERE id = $1', [r.id]); // paid on time
  }
  const allPaid = await currentScore(u);
  await currentScore(u);
  const n = await query('SELECT count(*)::int AS n FROM credit_score_history WHERE user_id = $1', [u]);
  assert.equal(n[0].n, 1);

  // un-pay the latest due installment -> it becomes overdue
  const last = due[due.length - 1];
  await query("UPDATE emi_schedule SET status = 'pending', paid_date = NULL WHERE id = $1", [last.id]);
  const withOverdue = await currentScore(u);
  assert.ok(withOverdue.score < allPaid.score, `${withOverdue.score} < ${allPaid.score}`);
  assert.equal(withOverdue.history.length, 2);
});
