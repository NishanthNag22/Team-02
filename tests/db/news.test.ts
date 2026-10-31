import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { articleImpact, listNews } from '../../src/lib/db/news';
import { createLoan } from '../../src/lib/db/loans';
import { query } from '../../src/lib/db/postgres';
import { cleanup, createTestUser } from './helpers';

const users: number[] = [];
after(async () => {
  await query("DELETE FROM news_articles WHERE guid LIKE 'test-%'");
  await cleanup(users);
});

test('+25 bps article: EMI change for floating loans only (AC-25)', async () => {
  const u = await createTestUser();
  users.push(u);
  await createLoan(u, { loanType: 'home', lender: 'Floating Bank', principal: 2500000, interestRate: 8.5, interestType: 'floating', tenureMonths: 240, startDate: '2026-01-01' });
  await createLoan(u, { loanType: 'vehicle', lender: 'Fixed Bank', principal: 500000, interestRate: 9, interestType: 'fixed', tenureMonths: 60, startDate: '2026-01-01' });

  const r = await articleImpact(u, 'sample-1');
  assert.equal(r.impacts.length, 1);
  assert.equal(r.impacts[0].lender, 'Floating Bank');
  assert.equal(r.impacts[0].newRate, 8.75);
  assert.ok(r.impacts[0].change > 0);

  const none = await articleImpact(u, 'sample-3');
  assert.match(none.note, /does not describe a lending-rate change/);
});

test('cached articles are listed and can be filtered by category', async () => {
  await query(
    `INSERT INTO news_articles (guid, title, link, category, rate_change_bps, published_at)
     VALUES ('test-1', 'Test policy', 'https://example.org', 'Monetary Policy', -25, now()),
            ('test-2', 'Test penalty', 'https://example.org/2', 'Regulation', NULL, now())
     ON CONFLICT (guid) DO NOTHING`,
  );
  const all = await listNews();
  assert.ok(all.articles.length >= 2);
  assert.notEqual(all.source, 'sample');
  const reg = await listNews('Regulation');
  assert.ok(reg.articles.every((a) => a.category === 'Regulation'));
});

test('unknown article is 404', async () => {
  const u = await createTestUser();
  users.push(u);
  await assert.rejects(articleImpact(u, '999999999'), { status: 404 });
});
