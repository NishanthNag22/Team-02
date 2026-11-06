import 'dotenv/config';
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { listNews, refreshNews } from '../../src/lib/db/news';
import { getPool, query } from '../../src/lib/db/postgres';

/** The RBI feed is replaced by a stub so the refresh path is tested without the network (FR-25, NFR-04). */
const realFetch = globalThis.fetch;
after(async () => {
  globalThis.fetch = realFetch;
  await query("DELETE FROM news_articles WHERE guid LIKE 'stub-%'");
  await getPool().end();
});

const RSS = `<rss><channel>
<item><title>Monetary Policy Statement</title><link>https://example.org/1</link>
<description>The MPC decided to increase the policy repo rate by 25 basis points.</description>
<pubDate>Fri, 09 Oct 2026 10:00:00 +0530</pubDate><guid>stub-1</guid></item>
<item><title>RBI imposes monetary penalty on a co-operative bank</title><link>https://example.org/2</link>
<pubDate>Thu, 08 Oct 2026 10:00:00 +0530</pubDate><guid>stub-2</guid></item>
</channel></rss>`;

test('refresh stores parsed articles and is idempotent', async () => {
  globalThis.fetch = (async () => new Response(RSS, { status: 200 })) as typeof fetch;
  assert.equal(await refreshNews(), 2);
  assert.equal(await refreshNews(), 2);
  const rows = await query("SELECT guid, rate_change_bps FROM news_articles WHERE guid LIKE 'stub-%' ORDER BY guid");
  assert.deepEqual(rows.map((r) => [r.guid, r.rate_change_bps]), [['stub-1', 25], ['stub-2', null]]);
});

test('feed errors become 503 and the news page falls back without calling the feed again', async () => {
  let calls = 0;
  globalThis.fetch = (async () => { calls++; return new Response('down', { status: 502 }); }) as typeof fetch;
  await assert.rejects(refreshNews(), { status: 503, message: /feed returned 502/ });

  globalThis.fetch = (async () => { calls++; return new Response('<rss></rss>', { status: 200 }); }) as typeof fetch;
  await assert.rejects(refreshNews(), { status: 503, message: /no articles/ });

  await query("UPDATE news_articles SET fetched_at = now() - interval '7 hours' WHERE guid LIKE 'stub-%'");
  const before = calls;
  const page = await listNews();
  assert.equal(calls, before, 'no new fetch within 60 s of a failure');
  assert.equal(page.source, 'cache');
  assert.match(page.notice ?? '', /unavailable/);
  assert.ok(page.articles.length >= 2);
});
