import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compareProducts, priceFor, type Product } from '../../src/lib/services/recommend';

const P = (id: number, over: Partial<Product>): Product => ({
  id, lender: `L${id}`, productName: `P${id}`, loanType: 'home', minRate: 8.5, maxRate: 10.5, minScore: 650,
  minAmount: 100000, maxAmount: 10000000, maxTenureMonths: 360, processingFeePct: 0.5, ...over,
});

test('rate moves from max_rate at min_score to min_rate at 900', () => {
  const p = P(1, {});
  assert.equal(priceFor(p, 650), 10.5);
  assert.equal(priceFor(p, 900), 8.5);
  assert.equal(priceFor(p, 775), 9.5);
});

test('ineligible products carry a reason and no rank (AC-20)', () => {
  const offers = compareProducts([P(1, { minScore: 800 }), P(2, {})], 700, 2000000, 240);
  const bad = offers.find((o) => o.productId === 1)!;
  assert.equal(bad.eligible, false);
  assert.match(bad.reasons[0], /at least 800/);
  assert.equal(bad.rank, null);
});

test('eligible products are ranked by total cost, cheapest first', () => {
  const offers = compareProducts([P(1, { minRate: 9, maxRate: 11 }), P(2, {}), P(3, { processingFeePct: 3 })], 750, 2000000, 240);
  const ranked = offers.filter((o) => o.eligible);
  assert.deepEqual(ranked.map((o) => o.rank), [1, 2, 3]);
  for (let i = 1; i < ranked.length; i++) assert.ok(ranked[i - 1].totalCost! <= ranked[i].totalCost!);
  assert.equal(ranked[0].productId, 2);
});

test('amount and tenure limits are checked', () => {
  const [o] = compareProducts([P(1, { maxTenureMonths: 120, maxAmount: 500000 })], 800, 900000, 240);
  assert.equal(o.reasons.length, 2);
});
