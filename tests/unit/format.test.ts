import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatINR } from '../../src/lib/format';

test('formatINR uses Indian digit grouping', () => {
  assert.equal(formatINR(9200000), '₹92,00,000.00');
});

test('formatINR keeps two decimals for paise', () => {
  assert.equal(formatINR(43391.16), '₹43,391.16');
});
