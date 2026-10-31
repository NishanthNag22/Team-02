import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { recommend } from '../../src/lib/db/loan-products';
import { cleanup, createTestUser } from './helpers';

const users: number[] = [];
after(() => cleanup(users));

test('home loan comparison returns the catalogue ranked, ineligible ones with reasons (FR-20)', async () => {
  const u = await createTestUser();
  users.push(u);
  const r = await recommend(u, { loanType: 'home', amount: 2500000, tenureMonths: 240 });
  assert.ok(r.offers.length >= 3);
  const eligible = r.offers.filter((o) => o.eligible);
  eligible.forEach((o, i) => assert.equal(o.rank, i + 1));
  for (const o of r.offers.filter((x) => !x.eligible)) assert.ok(o.reasons.length > 0);
  assert.match(r.note, /not a loan offer/i);
});

test('a too-long tenure makes vehicle products ineligible', async () => {
  const u = await createTestUser();
  users.push(u);
  const r = await recommend(u, { loanType: 'vehicle', amount: 800000, tenureMonths: 120 });
  assert.ok(r.offers.every((o) => !o.eligible && o.reasons.some((x) => x.includes('tenure'))));
});
