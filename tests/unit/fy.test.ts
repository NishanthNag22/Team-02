import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fyLabel, fyRange, fyStartYear, taxHints } from '../../src/lib/services/fy';

test('31 March belongs to the earlier FY, 1 April to the later one (AC-22)', () => {
  assert.equal(fyStartYear('2026-03-31'), 2025);
  assert.equal(fyStartYear('2026-04-01'), 2026);
  assert.equal(fyStartYear('2027-01-15'), 2026);
});

test('labels and ranges', () => {
  assert.equal(fyLabel(2026), 'FY 2026-27');
  assert.equal(fyLabel(2099), 'FY 2099-00');
  assert.deepEqual(fyRange(2026), { from: '2026-04-01', to: '2027-03-31' });
});

test('tax hints are capped at the section limits', () => {
  const h = taxHints([
    { loanType: 'home', lender: 'SBI', principalPaid: 180000, interestPaid: 240000 },
    { loanType: 'education', lender: 'BOB', principalPaid: 50000, interestPaid: 32000 },
    { loanType: 'vehicle', lender: 'HDFC', principalPaid: 90000, interestPaid: 20000 },
  ]);
  assert.deepEqual(h.map((x) => [x.section, x.claimable]), [['80C', 150000], ['24(b)', 200000], ['80E', 32000]]);
});

test('no qualifying loans → no hints', () => {
  assert.deepEqual(taxHints([{ loanType: 'vehicle', lender: 'x', principalPaid: 1, interestPaid: 1 }]), []);
});
