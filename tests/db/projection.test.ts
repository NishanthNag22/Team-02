import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { projectionFor } from '../../src/lib/db/projection';
import { createLoan } from '../../src/lib/db/loans';
import { createAsset } from '../../src/lib/db/assets';
import { cleanup, createTestUser } from './helpers';

const users: number[] = [];
after(() => cleanup(users));

test('projection starts from today\'s assets and loans (FR-21)', async () => {
  const u = await createTestUser();
  users.push(u);
  await createAsset(u, { name: 'FD', assetType: 'fd', liquidity: 'liquid', purchaseValue: 800000, currentValue: 800000, purchaseDate: '2025-01-01', valuationDate: '2026-10-01' });
  const loan = await createLoan(u, { loanType: 'personal', lender: 'Axis', principal: 300000, interestRate: 12, interestType: 'fixed', tenureMonths: 24, startDate: '2026-10-01' });
  const r = await projectionFor(u, { months: 36, growthPct: 0, monthlySurplus: 20000 });
  assert.equal(r.baseline[0].assets, 800000);
  assert.equal(r.baseline[0].liabilities, 300000);
  assert.equal(r.baseline[36].liabilities, 0);

  const closed = await projectionFor(u, { months: 36, growthPct: 0, monthlySurplus: 20000, closeLoanId: loan.id });
  assert.ok(Math.abs((closed.scenario?.difference ?? 0) - r.loans[0].remainingInterest) < 0.05);
});

test("closing another user's loan is a 404", async () => {
  const a = await createTestUser();
  const b = await createTestUser();
  users.push(a, b);
  const loan = await createLoan(a, { loanType: 'personal', lender: 'Axis', principal: 100000, interestRate: 12, interestType: 'fixed', tenureMonths: 12, startDate: '2026-10-01' });
  await assert.rejects(projectionFor(b, { months: 12, growthPct: 0, closeLoanId: loan.id }), { status: 404 });
});
