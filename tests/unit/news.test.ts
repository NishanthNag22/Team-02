import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, decode, emiAfterRateChange, parseRss } from '../../src/lib/services/news';

const XML = `<?xml version="1.0"?><rss version="2.0"><channel><title>RBI</title>
<item><title><![CDATA[Monetary Policy Statement, 2026-27 &amp; Resolution]]></title>
<link>https://www.rbi.org.in/Scripts/BS_PressReleaseDisplay.aspx?prid=1</link>
<description>&lt;p&gt;The MPC decided to reduce the policy repo rate by 25 basis points to 6.25 per cent.&lt;/p&gt;</description>
<pubDate>Fri, 09 Oct 2026 10:00:00 +0530</pubDate><guid>prid-1</guid></item>
<item><title>RBI imposes monetary penalty on XYZ Co-operative Bank</title><link>https://example.org/2</link>
<pubDate>Thu, 08 Oct 2026 17:00:00 +0530</pubDate></item>
<item><description>no title – skipped</description></item>
</channel></rss>`;

test('parses items, decodes CDATA/entities/HTML and skips untitled items', () => {
  const a = parseRss(XML);
  assert.equal(a.length, 2);
  assert.equal(a[0].title, 'Monetary Policy Statement, 2026-27 & Resolution');
  assert.equal(a[0].guid, 'prid-1');
  assert.equal(a[0].publishedAt, '2026-10-09T04:30:00.000Z');
  assert.equal(a[1].guid, 'https://example.org/2');
});

test('detects rate cuts, hikes, "from … to …" and unchanged', () => {
  assert.equal(parseRss(XML)[0].rateChangeBps, -25);
  assert.equal(classify('Monetary policy: repo rate increased by 50 bps').rateChangeBps, 50);
  assert.equal(classify('policy repo rate revised from 6.50 per cent to 6.75 per cent').rateChangeBps, 25);
  assert.equal(classify('MPC decided to keep the policy repo rate unchanged').rateChangeBps, 0);
  assert.equal(classify('RBI imposes monetary penalty on XYZ Bank').rateChangeBps, null);
});

test('categories', () => {
  assert.equal(classify('RBI imposes monetary penalty on XYZ Co-operative Bank').category, 'Regulation');
  assert.equal(classify('Result of the 91-day treasury bill auction').category, 'Markets');
  assert.equal(classify('Monetary Policy Statement').category, 'Monetary Policy');
});

test('a +25 bps change raises the EMI on a floating loan (AC-25)', () => {
  const r = emiAfterRateChange(2500000, 8.5, 216, 25);
  assert.equal(r.newRate, 8.75);
  assert.ok(r.change > 0);
  assert.equal(emiAfterRateChange(2500000, 8.5, 216, 0).change, 0);
});

test('decode handles numeric entities', () => {
  assert.equal(decode('&#8377; 5 lakh &#x2013; ok'), '₹ 5 lakh – ok');
});
