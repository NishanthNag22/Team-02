import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addMonths, calculateEmi, generateSchedule } from '../../src/lib/services/emi';

test('EMI for ₹50,00,000 at 8.5% over 240 months is ₹43,391.16', () => {
  assert.equal(calculateEmi(5_000_000, 8.5, 240), 43391.16);
});

test('schedule principal parts add up exactly to the principal and end at 0.00 (NFR-02)', () => {
  const s = generateSchedule(5_000_000, 8.5, 240, '2026-01-05');
  assert.equal(s.length, 240);
  const paise = s.reduce((sum, r) => sum + Math.round(r.principalComponent * 100), 0);
  assert.equal(paise, 5_000_000 * 100);
  assert.equal(s[s.length - 1].closingBalance, 0);
});

test('odd amounts and short tenures still close at exactly 0.00', () => {
  const s = generateSchedule(100_001, 7.25, 37, '2026-03-31');
  assert.equal(s[s.length - 1].closingBalance, 0);
  assert.equal(s.reduce((sum, r) => sum + Math.round(r.principalComponent * 100), 0), 10_000_100);
});

test('due dates clamp to the end of short months', () => {
  assert.equal(addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(addMonths('2026-01-05', 12), '2027-01-05');
});
