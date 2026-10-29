import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStatement, maskPan, rs, type StatementData } from '../../src/lib/services/pdf-statement';

const hex = (s: string) => Buffer.from(s, 'latin1').toString('hex');

const DATA: StatementData = {
  name: 'Priya Sharma', email: 'priya@example.com', pan: 'ABCDE1234F', generatedOn: '2026-10-30',
  summary: { totalAssets: 9200000, totalLiabilities: 2500000, netWorth: 6700000, liquidAssets: 800000 },
  assets: [{ name: 'Flat in Pune', assetType: 'property', currentValue: 8400000, valuationDate: '2026-09-01' }],
  loans: [{ lender: 'SBI', loanType: 'home', interestRate: 8.5, emiAmount: 26035, outstanding: 2500000 }],
  netWorthByMonth: [{ month: '2026-09', netWorth: 6600000 }, { month: '2026-10', netWorth: 6700000 }],
  fyToDate: { label: 'FY 2026-27', from: '2026-04-01', to: '2026-10-30', income: 990000, expense: 410000, net: 580000 },
};

test('PAN keeps only the last four characters', () => {
  assert.equal(maskPan('ABCDE1234F'), 'XXXXXX234F');
  assert.equal(maskPan(null), 'Not provided');
});

test('amounts use Rs. and Indian grouping', () => {
  assert.equal(rs(9200000), 'Rs. 92,00,000.00');
});

test('builds a PDF that shows the masked PAN and never the full PAN (SR-09)', async () => {
  const pdf = await buildStatement(DATA, { compress: false });
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
  const body = pdf.toString('latin1').toLowerCase();
  assert.ok(body.includes(hex('XXXXXX234F')), 'masked PAN missing');
  assert.ok(!body.includes(hex('ABCDE1234F')) && !body.includes('abcde1234f'), 'full PAN leaked');
  assert.ok(body.includes(hex('Active liabilities')));
});
