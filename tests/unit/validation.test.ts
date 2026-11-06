import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loginSchema, signupSchema } from '../../src/lib/validation/auth';
import { assetSchema } from '../../src/lib/validation/assets';
import { loanSchema } from '../../src/lib/validation/loans';
import { transactionFilterSchema, transactionSchema } from '../../src/lib/validation/transactions';
import { importCommitSchema } from '../../src/lib/validation/imports';
import { ruleSchema } from '../../src/lib/validation/rules';
import { receiptConfirmSchema } from '../../src/lib/validation/receipts';
import { documentSchema, vaultFilterSchema } from '../../src/lib/validation/vault';
import { prepaySchema, simulateSchema } from '../../src/lib/validation/prepayment';
import { projectionQuerySchema } from '../../src/lib/validation/projection';
import { recommendSchema } from '../../src/lib/validation/recommend';

/** Input validation at the API boundary (SR-06): boundary values from the STP test cases. */
const fieldError = (r: { success: boolean; error?: { flatten(): { fieldErrors: Record<string, string[]> } } }, field: string) =>
  !r.success && r.error!.flatten().fieldErrors[field]?.[0];

test('sign-up: password length 7/8, PAN format, email normalised (TC-003, TC-004)', () => {
  const base = { name: 'Asha Rao', email: '  Asha@Example.COM ', password: 'Abc12345' };
  const ok = signupSchema.parse(base);
  assert.equal(ok.email, 'asha@example.com');
  assert.equal(ok.role, 'individual');
  assert.equal(fieldError(signupSchema.safeParse({ ...base, password: 'Abc1234' }), 'password'), 'Password must be at least 8 characters');
  assert.equal(fieldError(signupSchema.safeParse({ ...base, panNumber: 'ABCD1234F' }), 'panNumber'), 'PAN must look like ABCDE1234F');
  assert.equal(signupSchema.parse({ ...base, panNumber: 'abcde1234f' }).panNumber, 'ABCDE1234F');
  assert.equal(signupSchema.parse({ ...base, panNumber: '' }).panNumber, undefined);
  assert.ok(fieldError(signupSchema.safeParse({ ...base, email: 'not-an-email' }), 'email'));
  assert.equal(loginSchema.safeParse({ email: 'a@b.co', password: '' }).success, false);
});

test('asset: valuation not before purchase; values ≥ 0; known types only (TC-011, TC-012)', () => {
  const base = { name: 'Gold', assetType: 'gold', purchaseValue: 0, currentValue: 0, purchaseDate: '2025-06-01' };
  assert.equal(assetSchema.safeParse(base).success, true);
  assert.equal(fieldError(assetSchema.safeParse({ ...base, valuationDate: '2025-05-31' }), 'valuationDate'), 'Valuation date cannot be before the purchase date');
  assert.ok(fieldError(assetSchema.safeParse({ ...base, currentValue: -1 }), 'currentValue'));
  assert.ok(fieldError(assetSchema.safeParse({ ...base, assetType: 'crypto' }), 'assetType'));
  assert.equal(assetSchema.parse({ ...base, valuationDate: '' }).valuationDate, undefined);
});

test('loan: rate 0 < r ≤ 60 and tenure 1–480 (TC-016)', () => {
  const base = { loanType: 'home', lender: 'SBI', principal: 100000, interestRate: 10, tenureMonths: 12, startDate: '2026-01-01' };
  for (const [rate, ok] of [[0, false], [0.01, true], [60, true], [60.01, false]] as const) assert.equal(loanSchema.safeParse({ ...base, interestRate: rate }).success, ok, `rate ${rate}`);
  for (const [n, ok] of [[0, false], [1, true], [480, true], [481, false]] as const) assert.equal(loanSchema.safeParse({ ...base, tenureMonths: n }).success, ok, `tenure ${n}`);
  assert.equal(loanSchema.parse(base).interestType, 'fixed');
  assert.ok(fieldError(loanSchema.safeParse({ ...base, startDate: '01-01-2026' }), 'startDate'));
});

test('transaction: amount > 0, ISO date, known type; filter limit ≤ 500 (TC-027)', () => {
  const base = { txnType: 'expense', amount: 0.01, txnDate: '2026-10-01' };
  assert.equal(transactionSchema.parse(base).category, 'Uncategorized');
  assert.ok(fieldError(transactionSchema.safeParse({ ...base, amount: 0 }), 'amount'));
  assert.ok(fieldError(transactionSchema.safeParse({ ...base, amount: -5 }), 'amount'));
  assert.equal(fieldError(transactionSchema.safeParse({ ...base, txnDate: '01-10-2026' }), 'txnDate'), 'Expected YYYY-MM-DD');
  assert.ok(fieldError(transactionSchema.safeParse({ ...base, txnType: 'gift' }), 'txnType'));
  assert.equal(transactionFilterSchema.parse({}).limit, 200);
  assert.equal(transactionFilterSchema.safeParse({ limit: '501' }).success, false);
});

test('import commit: 1–5000 rows, income/expense only (FR-14)', () => {
  const row = { txnDate: '2026-10-01', description: 'X', amount: 1, txnType: 'expense', category: 'Food' };
  assert.equal(importCommitSchema.safeParse({ fileName: 'a.csv', bank: 'HDFC', rows: [row] }).success, true);
  assert.equal(importCommitSchema.safeParse({ fileName: 'a.csv', bank: 'HDFC', rows: [] }).success, false);
  assert.equal(importCommitSchema.safeParse({ fileName: 'a.csv', bank: 'HDFC', rows: [{ ...row, txnType: 'loan' }] }).success, false);
  assert.equal(importCommitSchema.safeParse({ fileName: 'a.csv', bank: 'HDFC', rows: Array(5001).fill(row) }).success, false);
});

test('rules, receipts, vault, prepayment, projection and recommendation schemas', () => {
  assert.equal(ruleSchema.parse({ keyword: 'AMAZON', category: 'Shopping' }).txnType, 'expense');
  assert.equal(fieldError(ruleSchema.safeParse({ keyword: 'A', category: 'X' }), 'keyword'), 'Keyword must be at least 2 characters');

  const r = receiptConfirmSchema.parse({ merchant: 'Apollo', amount: '455.28', date: '2026-10-12', saveToVault: 'true' });
  assert.deepEqual([r.amount, r.category, r.saveToVault], [455.28, 'Shopping', true]);
  assert.equal(receiptConfirmSchema.parse({ merchant: 'A', amount: 1, date: '2026-10-12' }).saveToVault, false);

  const d = documentSchema.parse({ title: 'Deed', tags: 'Loan Papers, SBI , ,2026', loanId: '' });
  assert.deepEqual([d.tags, d.loanId], [['loan papers', 'sbi', '2026'], undefined]);
  assert.equal(documentSchema.safeParse({ title: 'x', tags: Array(11).fill('t').join(',') }).success, false);
  assert.deepEqual(documentSchema.parse({ title: 'x', tags: undefined }).tags, []);
  assert.equal(vaultFilterSchema.parse({ tag: 'SBI', assetId: '7' }).assetId, 7);

  assert.equal(simulateSchema.safeParse({ amount: 0 }).success, false);
  assert.equal(prepaySchema.safeParse({ amount: 1000, mode: 'reduce_tenure', fundingAssetId: null }).success, true);
  assert.equal(prepaySchema.safeParse({ amount: 1000, mode: 'skip_emi' }).success, false);

  assert.deepEqual(projectionQuerySchema.parse({}), { months: 60, growthPct: 8 });
  for (const [m, ok] of [[5, false], [6, true], [360, true], [361, false]] as const) assert.equal(projectionQuerySchema.safeParse({ months: m }).success, ok, `months ${m}`);
  assert.equal(projectionQuerySchema.safeParse({ growthPct: 31 }).success, false);

  assert.equal(recommendSchema.safeParse({ loanType: 'home', amount: 1, tenureMonths: 481 }).success, false);
  assert.equal(recommendSchema.safeParse({ loanType: 'yacht', amount: 1, tenureMonths: 12 }).success, false);
});
