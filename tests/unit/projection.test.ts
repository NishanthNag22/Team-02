import { test } from 'node:test';
import assert from 'node:assert/strict';
import { projectNetWorth, remainingInterest, type ProjectionLoan } from '../../src/lib/services/projection';
import { generateSchedule } from '../../src/lib/services/emi';

const sched = generateSchedule(500000, 10, 24, '2026-01-05');
const loan: ProjectionLoan = {
  id: 7, lender: 'HDFC', outstanding: 500000,
  schedule: sched.map((s) => ({ emi: s.emiAmount, closingBalance: s.closingBalance })),
};

test('no loans and no growth: net worth rises by the surplus each month', () => {
  const p = projectNetWorth({ assets: 100000, monthlySurplus: 10000, growthPct: 0, months: 12, loans: [] });
  assert.equal(p.length, 13);
  assert.equal(p[12].netWorth, 220000);
});

test('growth compounds monthly', () => {
  const p = projectNetWorth({ assets: 100000, monthlySurplus: 0, growthPct: 12, months: 12, loans: [] });
  assert.equal(p[12].assets, Math.round(100000 * 1.01 ** 12 * 100) / 100);
});

test('liabilities follow the EMI schedule and reach zero', () => {
  const p = projectNetWorth({ assets: 1000000, monthlySurplus: 30000, growthPct: 0, months: 24, loans: [loan] });
  assert.equal(p[0].liabilities, 500000);
  assert.equal(p[24].liabilities, 0);
});

test('at 0% growth, closing a loan now gains exactly its remaining interest', () => {
  const base = projectNetWorth({ assets: 1000000, monthlySurplus: 30000, growthPct: 0, months: 36, loans: [loan] });
  const closed = projectNetWorth({ assets: 1000000, monthlySurplus: 30000, growthPct: 0, months: 36, loans: [loan], closeLoanId: 7 });
  assert.ok(Math.abs(closed[36].netWorth - base[36].netWorth - remainingInterest(loan)) < 0.05);
  assert.ok(remainingInterest(loan) > 0);
});
