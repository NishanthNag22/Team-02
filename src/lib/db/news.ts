import { query } from './postgres';
import { HttpError } from '@/lib/api';
import { emiAfterRateChange, parseRss, RBI_FEED_URL, SAMPLE_ARTICLES, type Article } from '@/lib/services/news';

const CACHE_HOURS = 6;
const RETRY_AFTER_MS = 60_000; // after a failed fetch, don't try again for 60 s so pages don't stall (NFR-04)
let lastFailure = 0;

export interface NewsItem extends Article { id: string; illustrative: boolean }

/** Downloads the RBI feed (8 s timeout) and upserts it into the cache. Returns how many articles were read. */
export async function refreshNews(): Promise<number> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(RBI_FEED_URL, { signal: ctrl.signal, headers: { 'User-Agent': 'WealthWise/1.0' }, cache: 'no-store' });
    if (!res.ok) throw new Error(`feed returned ${res.status}`);
    const articles = parseRss(await res.text());
    if (articles.length === 0) throw new Error('feed had no articles');
    for (const a of articles) {
      await query(
        `INSERT INTO news_articles (guid, title, link, summary, category, rate_change_bps, published_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (guid) DO UPDATE SET title = EXCLUDED.title, summary = EXCLUDED.summary, category = EXCLUDED.category,
                                           rate_change_bps = EXCLUDED.rate_change_bps, fetched_at = now()`,
        [a.guid, a.title, a.link, a.summary, a.category, a.rateChangeBps, a.publishedAt],
      );
    }
    return articles.length;
  } catch (e) {
    lastFailure = Date.now();
    throw new HttpError(503, `The RBI news feed is unavailable (${(e as Error).message}).`);
  } finally {
    clearTimeout(timer);
  }
}

const toItem = (r: Record<string, unknown>): NewsItem => ({
  id: String(r.id), guid: String(r.guid), title: String(r.title), link: String(r.link), summary: String(r.summary),
  category: r.category as Article['category'], rateChangeBps: r.rate_change_bps == null ? null : Number(r.rate_change_bps),
  publishedAt: new Date(r.published_at as string).toISOString(), illustrative: false,
});

/**
 * News for the feed page (FR-25). Uses the cache, refreshing it when older than 6 hours.
 * If there is no feed and no cache, returns the sample articles, clearly marked illustrative.
 */
export async function listNews(category?: string) {
  const age = await query("SELECT EXTRACT(EPOCH FROM now() - max(fetched_at)) / 3600 AS hours FROM news_articles");
  const stale = age[0].hours == null || Number(age[0].hours) > CACHE_HOURS;
  let notice: string | null = null;
  if (stale && Date.now() - lastFailure > RETRY_AFTER_MS) {
    await refreshNews().catch((e: Error) => { notice = e.message; });
  } else if (stale) {
    notice = 'The RBI news feed is unavailable right now.';
  }

  const rows = await query(
    `SELECT id, guid, title, link, summary, category, rate_change_bps, published_at FROM news_articles
      WHERE ($1::text IS NULL OR category = $1) ORDER BY published_at DESC LIMIT 50`,
    [category ?? null],
  );
  const cached = await query('SELECT count(*)::int AS n FROM news_articles');
  if (Number(cached[0].n) === 0) {
    return {
      source: 'sample' as const,
      notice: `${notice ?? 'No news cached yet.'} Showing illustrative sample articles.`,
      articles: SAMPLE_ARTICLES.filter((a) => !category || a.category === category).map((a) => ({ ...a, id: a.guid, illustrative: true })),
    };
  }
  return { source: notice ? ('cache' as const) : ('rbi' as const), notice, articles: rows.map(toItem) };
}

async function findArticle(id: string): Promise<NewsItem | null> {
  const sample = SAMPLE_ARTICLES.find((a) => a.guid === id);
  if (sample) return { ...sample, id: sample.guid, illustrative: true };
  if (!/^\d+$/.test(id)) return null;
  const rows = await query('SELECT id, guid, title, link, summary, category, rate_change_bps, published_at FROM news_articles WHERE id = $1', [id]);
  return rows[0] ? toItem(rows[0]) : null;
}

/** EMI change on each of MY active floating-rate loans for the article's rate change (FR-25). */
export async function articleImpact(userId: number, articleId: string) {
  const article = await findArticle(articleId);
  if (!article) throw new HttpError(404, 'Article not found');
  if (article.rateChangeBps == null) {
    return { article, impacts: [], note: 'This article does not describe a lending-rate change.' };
  }
  const loans = await query(
    `SELECT l.id, l.lender, l.interest_rate,
            COUNT(e.id) AS remaining,
            (SELECT n.closing_balance + n.principal_component FROM emi_schedule n
              WHERE n.loan_id = l.id AND n.status <> 'paid' ORDER BY n.installment_no LIMIT 1) AS outstanding
       FROM loans l JOIN emi_schedule e ON e.loan_id = l.id AND e.status <> 'paid'
      WHERE l.user_id = $1 AND l.status = 'active' AND l.interest_type = 'floating'
      GROUP BY l.id ORDER BY l.id`,
    [userId],
  );
  const impacts = loans.map((l) => ({
    loanId: Number(l.id), lender: String(l.lender), rate: Number(l.interest_rate), outstanding: Number(l.outstanding),
    remainingMonths: Number(l.remaining),
    ...emiAfterRateChange(Number(l.outstanding), Number(l.interest_rate), Number(l.remaining), article.rateChangeBps!),
  }));
  const note = article.rateChangeBps === 0 ? 'The rate is unchanged, so your EMIs stay the same.'
    : impacts.length === 0 ? 'You have no active floating-rate loans, so this change does not affect your EMIs.'
      : 'Indicative: assumes your lender passes on the full change and keeps the remaining tenure.';
  return { article, impacts, note };
}
