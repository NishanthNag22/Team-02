/**
 * RBI press-release feed parsing and classification (FR-25). Pure functions, no network.
 */

export const RBI_FEED_URL = 'https://www.rbi.org.in/pressreleases_rss.xml';

export interface Article {
  guid: string;
  title: string;
  link: string;
  summary: string;
  category: 'Monetary Policy' | 'Banking' | 'Regulation' | 'Markets' | 'Other';
  rateChangeBps: number | null;
  publishedAt: string; // ISO
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#\d+|#x[0-9a-f]+|\w+);/gi, (m, e: string) =>
      e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (ENTITIES[e.toLowerCase()] ?? m))
    .replace(/\s+/g, ' ')
    .trim();
}

const tag = (item: string, name: string) => {
  const m = item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decode(m[1]) : '';
};

/** Reads <item> entries from RSS 2.0 XML. Items without a title are skipped. */
export function parseRss(xml: string): Article[] {
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];
  return items.flatMap((item) => {
    const title = tag(item, 'title');
    if (!title) return [];
    const link = tag(item, 'link');
    const summary = tag(item, 'description').slice(0, 600);
    const date = new Date(tag(item, 'pubDate'));
    return [{
      guid: tag(item, 'guid') || link || title,
      title, link, summary,
      ...classify(`${title} ${summary}`),
      publishedAt: (Number.isNaN(date.getTime()) ? new Date() : date).toISOString(),
    }];
  });
}

/**
 * Category from keywords, and a repo-rate change in basis points when the text states one:
 * "reduced by 25 basis points", "increase the policy repo rate by 50 bps", "from 6.50 per cent to 6.25 per cent".
 */
export function classify(text: string): Pick<Article, 'category' | 'rateChangeBps'> {
  const t = text.toLowerCase();
  let rateChangeBps: number | null = null;

  if (/repo rate|policy rate|monetary policy/.test(t)) {
    const by = t.match(/(reduc\w*|cut\w*|lower\w*|decreas\w*|increas\w*|rais\w*|hik\w*)[^.]{0,60}?by\s+(\d{1,3})\s*(basis points|bps)/);
    const fromTo = t.match(/from\s+(\d{1,2}(?:\.\d{1,2})?)\s*(?:per cent|%)\s+to\s+(\d{1,2}(?:\.\d{1,2})?)\s*(?:per cent|%)/);
    if (by) rateChangeBps = (/^(reduc|cut|lower|decreas)/.test(by[1]) ? -1 : 1) * Number(by[2]);
    else if (fromTo) rateChangeBps = Math.round((Number(fromTo[2]) - Number(fromTo[1])) * 100);
    else if (/unchanged|keep\w* the policy repo rate|status quo/.test(t)) rateChangeBps = 0;
  }

  const category: Article['category'] =
    /monetary policy|repo rate|policy rate|inflation/.test(t) ? 'Monetary Policy'
      : /penalty|directions|circular|guidelines|regulat|licen[cs]e|cancel/.test(t) ? 'Regulation'
        : /bank|nbfc|co-operative|payment/.test(t) ? 'Banking'
          : /forex|bond|treasury|auction|g-sec|reserves/.test(t) ? 'Markets'
            : 'Other';
  return { category, rateChangeBps };
}

/** Change in EMI for a loan whose rate moves by `bps`, on the same outstanding and remaining months. */
export function emiAfterRateChange(outstanding: number, ratePct: number, remainingMonths: number, bps: number) {
  const emi = (rate: number) => {
    const r = rate / 12 / 100;
    if (r === 0) return outstanding / remainingMonths;
    const f = Math.pow(1 + r, remainingMonths);
    return (outstanding * r * f) / (f - 1);
  };
  const before = Math.round(emi(ratePct) * 100) / 100;
  const newRate = Math.max(0, ratePct + bps / 100);
  const after = Math.round(emi(newRate) * 100) / 100;
  return { newRate: Math.round(newRate * 100) / 100, emiBefore: before, emiAfter: after, change: Math.round((after - before) * 100) / 100 };
}

/** Shown when the RBI feed and the cache are both unavailable. Clearly marked as illustrative. */
export const SAMPLE_ARTICLES: Article[] = [
  {
    guid: 'sample-1', title: '[Illustrative] Monetary Policy Statement: repo rate increased by 25 basis points',
    link: '', summary: 'Sample article for demonstration. The policy repo rate is increased by 25 basis points from 6.50 per cent to 6.75 per cent.',
    category: 'Monetary Policy', rateChangeBps: 25, publishedAt: '2026-10-01T05:30:00.000Z',
  },
  {
    guid: 'sample-2', title: '[Illustrative] Monetary Policy Statement: repo rate unchanged',
    link: '', summary: 'Sample article for demonstration. The committee decided to keep the policy repo rate unchanged at 6.50 per cent.',
    category: 'Monetary Policy', rateChangeBps: 0, publishedAt: '2026-08-08T05:30:00.000Z',
  },
  {
    guid: 'sample-3', title: '[Illustrative] Monetary penalty imposed on a co-operative bank',
    link: '', summary: 'Sample article for demonstration of the Regulation category.',
    category: 'Regulation', rateChangeBps: null, publishedAt: '2026-07-15T05:30:00.000Z',
  },
];
