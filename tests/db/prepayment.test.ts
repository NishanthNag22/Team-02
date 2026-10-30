import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createLoan, getLoan, getSchedule, payInstallment } from '../../src/lib/db/loans';
import { createAsset, getAsset } from '../../src/lib/db/assets';
import { applyPrepayment, simulatePrepayment } from '../../src/lib/db/prepayments';
import { query } from '../../src/lib/db/postgres';
import { cleanup, createTestUser } from './helpers';

const users: number[] = [];
after(() => cleanup(users));

const LOAN = { loanType: 'home' as const, lender: 'SBI', principal: 2000000, interestRate: 9, interestType: 'floating' as const, tenureMonths: 120, startDate: '2026-01-10' };

async function setup() {
  const u = await createTestUser();
  users.push(u);
  const loan = await createLoan(u, LOAN);
  const sched = await getSchedule(u, loan.id);
  for (const r of sched.slice(0, 6)) await payInstallment(u, r.id);
  return { u, loan };
}

test('simulate saves nothing and shows both options (FR-11)', async () => {
  const { u, loan } = await setup();
  const before = await getSchedule(u, loan.id);
  const sim = await simulatePrepayment(u, loan.id, 300000);
  assert.ok(sim.reduceTenure.monthsAfter < sim.reduceTenure.monthsBefore);
  assert.ok(sim.reduceEmi.emiAfter < sim.reduceEmi.emiBefore);
  assert.deepEqual(await getSchedule(u, loan.id), before);
});

test('apply reduce-tenure: paid rows untouched, outstanding drops by the amount, ledger entry written', async () => {
  const { u, loan } = await setup();
  const before = await getLoan(u, loan.id);
  const r = await applyPrepayment(u, loan.id, { amount: 300000, mode: 'reduce_tenure' });
  const after = await getLoan(u, loan.id);
  const sched = await getSchedule(u, loan.id);

  assert.equal(sched.filter((x) => x.status === 'paid').length, 6);
  assert.equal(after!.outstanding, Math.round((before!.outstanding - 300000) * 100) / 100);
  assert.equal(after!.emiAmount, before!.emiAmount);
  assert.equal(sched.length, 6 + r.monthsAfter);
  assert.equal(sched[sched.length - 1].closingBalance, 0);
  const txn = await query("SELECT amount FROM transactions WHERE user_id = $1 AND category = 'Prepayment'", [u]);
  assert.equal(Number(txn[0].amount), 300000);
});

test('apply funded from an asset deducts the asset; too-small asset is refused and nothing changes', async () => {
  const { u, loan } = await setup();
  const fd = await createAsset(u, { name: 'FD', assetType: 'fd', liquidity: 'liquid', purchaseValue: 500000, currentValue: 500000, purchaseDate: '2025-01-01', valuationDate: '2026-01-01' });
  const small = await createAsset(u, { name: 'Cash', assetType: 'cash', liquidity: 'liquid', purchaseValue: 1000, currentValue: 1000, purchaseDate: '2025-01-01', valuationDate: '2026-01-01' });

  const before = await getSchedule(u, loan.id);
  await assert.rejects(applyPrepayment(u, loan.id, { amount: 200000, mode: 'reduce_emi', fundingAssetId: small.id }), { status: 422 });
  assert.deepEqual(await getSchedule(u, loan.id), before);

  await applyPrepayment(u, loan.id, { amount: 200000, mode: 'reduce_emi', fundingAssetId: fd.id });
  assert.equal((await getAsset(u, fd.id))!.currentValue, 300000);
});

test('amount must be below outstanding; other user gets 404', async () => {
  const { u, loan } = await setup();
  const other = await createTestUser();
  users.push(other);
  await assert.rejects(applyPrepayment(u, loan.id, { amount: 99_000_000, mode: 'reduce_emi' }), { status: 422 });
  await assert.rejects(simulatePrepayment(other, loan.id, 1000), { status: 404 });
});
