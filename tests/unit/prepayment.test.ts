import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateSchedule } from '../../src/lib/services/emi';
import { planPrepayment, type RemainingInstallment } from '../../src/lib/services/prepayment';

// ₹30 lakh home loan, 8.5 %, 240 months; 24 EMIs already paid.
const full = generateSchedule(3000000, 8.5, 240, '2024-10-05');
const paid = 24;
const remaining: RemainingInstallment[] = full.slice(paid).map((s) => ({ dueDate: s.dueDate, emiAmount: s.emiAmount, interestComponent: s.interestComponent }));
const outstanding = full[paid - 1].closingBalance;

test('reduce tenure keeps the EMI and finishes earlier', () => {
  const p = planPrepayment(outstanding, 8.5, remaining, 500000, 'reduce_tenure');
  assert.equal(p.emiAfter, p.emiBefore);
  assert.ok(p.monthsAfter < p.monthsBefore);
  assert.equal(p.schedule[p.schedule.length - 1].closingBalance, 0);
  assert.equal(p.outstandingAfter, Math.round((outstanding - 500000) * 100) / 100);
});

test('reduce EMI keeps the end date and lowers the EMI', () => {
  const p = planPrepayment(outstanding, 8.5, remaining, 500000, 'reduce_emi');
  assert.equal(p.monthsAfter, p.monthsBefore);
  assert.ok(p.emiAfter < p.emiBefore);
  assert.equal(p.schedule[p.schedule.length - 1].dueDate, remaining[remaining.length - 1].dueDate);
  assert.equal(p.schedule[p.schedule.length - 1].closingBalance, 0);
});

test('reducing tenure saves more interest than reducing EMI', () => {
  const t = planPrepayment(outstanding, 8.5, remaining, 500000, 'reduce_tenure');
  const e = planPrepayment(outstanding, 8.5, remaining, 500000, 'reduce_emi');
  assert.ok(t.interestSaved > e.interestSaved);
  assert.ok(e.interestSaved > 0);
});

test('principal in the new schedule adds up to the new outstanding', () => {
  const p = planPrepayment(outstanding, 8.5, remaining, 123456.78, 'reduce_tenure');
  const sum = p.schedule.reduce((s, x) => s + Math.round(x.principalComponent * 100), 0) / 100;
  assert.equal(sum, p.outstandingAfter);
});

test('amount must be positive and less than the outstanding', () => {
  assert.throws(() => planPrepayment(outstanding, 8.5, remaining, 0, 'reduce_emi'), /greater than 0/);
  assert.throws(() => planPrepayment(outstanding, 8.5, remaining, outstanding, 'reduce_emi'), /less than the outstanding/);
});
