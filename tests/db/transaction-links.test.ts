import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { createAsset, deleteAsset } from '../../src/lib/db/assets';
import { createLoan, deleteLoan } from '../../src/lib/db/loans';
import { createTransaction, listTransactions } from '../../src/lib/db/transactions';
import { cleanup, createTestUser } from './helpers';

const users: number[] = [];
after(() => cleanup(users));

test('deleting an asset or loan keeps its transactions with the link cleared (FR-05, FR-08)', async () => {
  const u = await createTestUser();
  users.push(u);
  const asset = await createAsset(u, { name: 'Gold', assetType: 'gold', liquidity: 'liquid', purchaseValue: 1000, currentValue: 1000, purchaseDate: '2025-01-01', valuationDate: '2025-01-01' });
  const loan = await createLoan(u, { loanType: 'personal', lender: 'Axis', principal: 10000, interestRate: 12, interestType: 'fixed', tenureMonths: 6, startDate: '2026-01-01' });
  const t1 = await createTransaction(u, { txnType: 'asset', amount: 1000, txnDate: '2026-01-02', category: 'Gold', description: 'bought gold', relatedAssetId: asset.id });
  const t2 = await createTransaction(u, { txnType: 'loan', amount: 500, txnDate: '2026-01-03', category: 'EMI Payment', description: 'manual EMI', relatedLoanId: loan.id });

  await deleteAsset(u, asset.id);
  await deleteLoan(u, loan.id);

  const rows = await listTransactions(u, { limit: 100 });
  assert.equal(rows.find((r) => r.id === t1.id)?.relatedAssetId, null);
  assert.equal(rows.find((r) => r.id === t2.id)?.relatedLoanId, null);
});

test('a transaction cannot point at an asset that does not exist', async () => {
  const u = await createTestUser();
  users.push(u);
  await assert.rejects(createTransaction(u, { txnType: 'asset', amount: 1, txnDate: '2026-01-02', category: 'X', description: 'x', relatedAssetId: 999999999 }), { code: '23503' });
});
