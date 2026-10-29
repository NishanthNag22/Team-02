import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { statementData } from '../../src/lib/db/statement';
import { buildStatement } from '../../src/lib/services/pdf-statement';
import { createAsset } from '../../src/lib/db/assets';
import { createLoan } from '../../src/lib/db/loans';
import { query } from '../../src/lib/db/postgres';
import { cleanup, createTestUser } from './helpers';

const users: number[] = [];
after(() => cleanup(users));

test('statement has summary, assets, active loans and FY to date; PDF is produced (FR-23)', async () => {
  const u = await createTestUser();
  users.push(u);
  const pan = `ABCDE${String(u % 10000).padStart(4, '0')}F`;
  await query('UPDATE users SET pan_number = $2 WHERE id = $1', [u, pan]);
  await createAsset(u, { name: 'Gold', assetType: 'gold', liquidity: 'liquid', purchaseValue: 200000, currentValue: 250000, purchaseDate: '2024-01-01', valuationDate: '2026-10-01' });
  await createLoan(u, { loanType: 'personal', lender: 'ICICI', principal: 100000, interestRate: 11, interestType: 'fixed', tenureMonths: 12, startDate: '2026-10-01' });

  const d = await statementData(u);
  assert.equal(d.pan, pan);
  assert.equal(d.summary.totalAssets, 250000);
  assert.equal(d.assets.length, 1);
  assert.equal(d.loans[0].lender, 'ICICI');
  assert.match(d.fyToDate.label, /^FY \d{4}-\d{2}$/);

  const pdf = await buildStatement(d, { compress: false });
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
  assert.ok(!pdf.toString('latin1').toLowerCase().includes(Buffer.from(pan).toString('hex')));
});
