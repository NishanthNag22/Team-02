import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeScore, WEIGHTS, type ScoreInputs } from '../../src/lib/services/credit-score';

const good: ScoreInputs = {
  dueInstallments: 36, paidOnTime: 36, paidLate: 0, overdue: 0,
  totalAssets: 5000000, totalLiabilities: 1000000, loanTypes: ['home', 'vehicle'], monthsSinceFirstLoan: 90, closedLoans: 1,
};

test('weights add up to 1', () => {
  assert.equal(Math.round(Object.values(WEIGHTS).reduce((a, b) => a + b, 0) * 1000), 1000);
});

test('score is always within 300–900', () => {
  const worst = computeScore({ dueInstallments: 10, paidOnTime: 0, paidLate: 0, overdue: 10, totalAssets: 0, totalLiabilities: 100, loanTypes: ['personal'], monthsSinceFirstLoan: 0, closedLoans: 0 });
  const best = computeScore({ ...good, closedLoans: 5 });
  assert.ok(worst.score >= 300 && worst.score <= 900);
  assert.ok(best.score >= 300 && best.score <= 900);
  assert.equal(worst.band, 'Poor');
});

test('a good record scores Excellent', () => {
  const r = computeScore(good);
  assert.ok(r.score >= 750, String(r.score));
  assert.equal(r.factors.length, 5);
});

test('an overdue installment lowers the score (AC-19)', () => {
  const base = computeScore(good).score;
  const withOverdue = computeScore({ ...good, dueInstallments: 37, overdue: 1 }).score;
  assert.ok(withOverdue < base);
});

test('more debt relative to assets lowers the score', () => {
  assert.ok(computeScore({ ...good, totalLiabilities: 6000000 }).score < computeScore(good).score);
});
