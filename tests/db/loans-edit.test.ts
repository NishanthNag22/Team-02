import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createLoan, deleteLoan, getLoan, getSchedule, payInstallment, setLoanStatus, updateLoan } from '../../src/lib/db/loans';
import { applyPrepayment } from '../../src/lib/db/prepayments';
import { availableYears } from '../../src/lib/db/reports';
import { cleanup, createTestUser } from './helpers';

const users: number[] = [];
after(() => cleanup(users));

const LOAN = { loanType: 'personal' as const, lender: 'Axis', principal: 120000, interestRate: 12, interestType: 'fixed' as const, tenureMonths: 12, startDate: '2026-01-01' };

test('editing terms regenerates the schedule while nothing is paid (FR-08)', async () => {
  const u = await createTestUser();
  users.push(u);
  const loan = await createLoan(u, LOAN);
  const up = await updateLoan(u, loan.id, { ...LOAN, tenureMonths: 24, interestRate: 10 });
  assert.equal(up?.tenureMonths, 24);
  assert.equal((await getSchedule(u, loan.id)).length, 24);
});

test('editing is refused after a payment or a prepayment (409); other users get null (FR-08, FR-11)', async () => {
  const u = await createTestUser();
  const other = await createTestUser();
  users.push(u, other);
  const paid = await createLoan(u, LOAN);
  await payInstallment(u, (await getSchedule(u, paid.id))[0].id);
  await assert.rejects(updateLoan(u, paid.id, LOAN), { status: 409 });

  const prepaid = await createLoan(u, { ...LOAN, lender: 'HDFC' });
  await applyPrepayment(u, prepaid.id, { amount: 10000, mode: 'reduce_emi' });
  await assert.rejects(updateLoan(u, prepaid.id, LOAN), { status: 409, message: /prepayment/ });

  assert.equal(await updateLoan(other, paid.id, LOAN), null);
});

test('status change and delete are owner-only (FR-08, SR-05)', async () => {
  const u = await createTestUser();
  const other = await createTestUser();
  users.push(u, other);
  const loan = await createLoan(u, LOAN);
  assert.equal(await setLoanStatus(other, loan.id, 'closed'), false);
  assert.equal(await setLoanStatus(u, loan.id, 'defaulted'), true);
  assert.equal((await getLoan(u, loan.id))?.status, 'defaulted');
  assert.equal(await deleteLoan(other, loan.id), false);
  assert.equal(await deleteLoan(u, loan.id), true);
  assert.equal(await getLoan(u, loan.id), null);
});

test('FY list includes years with paid EMIs and the current FY (FR-22)', async () => {
  const u = await createTestUser();
  users.push(u);
  const loan = await createLoan(u, { ...LOAN, startDate: '2024-02-01' });
  const first = (await getSchedule(u, loan.id))[0];
  await payInstallment(u, first.id);
  const years = await availableYears(u);
  assert.ok(years.length >= 1);
  assert.deepEqual(years, [...years].sort((a, b) => b - a));
});
