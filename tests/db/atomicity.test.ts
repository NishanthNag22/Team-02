import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createLoan, getSchedule, payInstallment } from '../../src/lib/db/loans';
import { createAsset, getAsset } from '../../src/lib/db/assets';
import { applyPrepayment } from '../../src/lib/db/prepayments';
import { query } from '../../src/lib/db/postgres';
import { cleanup, createTestUser } from './helpers';

/**
 * NFR-03 fault injection. A temporary trigger makes the LAST step of an operation fail when the
 * loan's lender is a special marker; we then check that nothing from the earlier steps remained.
 */
const users: number[] = [];
let u = 0;

before(async () => {
  u = await createTestUser();
  users.push(u);
  await query(`
    CREATE OR REPLACE FUNCTION ww_test_fail() RETURNS trigger LANGUAGE plpgsql AS $$
    DECLARE lender TEXT;
    BEGIN
      IF TG_TABLE_NAME = 'emi_schedule' THEN
        SELECT l.lender INTO lender FROM loans l WHERE l.id = NEW.loan_id;
        IF lender = 'FAIL-SCHEDULE' THEN RAISE EXCEPTION 'injected failure'; END IF;
      ELSIF TG_TABLE_NAME = 'transactions' THEN
        IF NEW.description LIKE '%FAIL-LEDGER%' THEN RAISE EXCEPTION 'injected failure'; END IF;
      ELSIF TG_TABLE_NAME = 'loan_prepayments' THEN
        SELECT l.lender INTO lender FROM loans l WHERE l.id = NEW.loan_id;
        IF lender = 'FAIL-PREPAY' THEN RAISE EXCEPTION 'injected failure'; END IF;
      END IF;
      RETURN NEW;
    END $$`);
  for (const t of ['emi_schedule', 'transactions', 'loan_prepayments']) {
    await query(`DROP TRIGGER IF EXISTS ww_test_fail ON ${t}`);
    await query(`CREATE TRIGGER ww_test_fail BEFORE INSERT ON ${t} FOR EACH ROW EXECUTE FUNCTION ww_test_fail()`);
  }
});

after(async () => {
  for (const t of ['emi_schedule', 'transactions', 'loan_prepayments']) await query(`DROP TRIGGER IF EXISTS ww_test_fail ON ${t}`);
  await query('DROP FUNCTION IF EXISTS ww_test_fail()');
  await cleanup(users);
});

const LOAN = { loanType: 'personal' as const, principal: 120000, interestRate: 12, interestType: 'fixed' as const, tenureMonths: 12, startDate: '2026-09-01' };
const count = async (sql: string) => (await query<{ n: number }>(sql, [u]))[0].n;

test('loan creation: a schedule failure leaves no loan behind', async () => {
  await assert.rejects(createLoan(u, { ...LOAN, lender: 'FAIL-SCHEDULE' }));
  assert.equal(await count("SELECT count(*)::int AS n FROM loans WHERE user_id = $1 AND lender = 'FAIL-SCHEDULE'"), 0);
});

test('EMI payment: a ledger failure leaves the installment unpaid', async () => {
  const loan = await createLoan(u, { ...LOAN, lender: 'FAIL-LEDGER' });
  const [first] = await getSchedule(u, loan.id);
  await assert.rejects(payInstallment(u, first.id));
  const [again] = await getSchedule(u, loan.id);
  assert.equal(again.status, 'pending');
  assert.equal(again.paidDate, null);
});

test('prepayment: a failure at the last step leaves schedule, ledger and asset unchanged', async () => {
  const loan = await createLoan(u, { ...LOAN, lender: 'FAIL-PREPAY' });
  const fd = await createAsset(u, { name: 'FD', assetType: 'fd', liquidity: 'liquid', purchaseValue: 50000, currentValue: 50000, purchaseDate: '2025-01-01', valuationDate: '2026-01-01' });
  const schedule = await getSchedule(u, loan.id);
  const txns = await count('SELECT count(*)::int AS n FROM transactions WHERE user_id = $1');

  await assert.rejects(applyPrepayment(u, loan.id, { amount: 20000, mode: 'reduce_tenure', fundingAssetId: fd.id }));

  assert.deepEqual(await getSchedule(u, loan.id), schedule);
  assert.equal(await count('SELECT count(*)::int AS n FROM transactions WHERE user_id = $1'), txns);
  assert.equal((await getAsset(u, fd.id))!.currentValue, 50000);
});
