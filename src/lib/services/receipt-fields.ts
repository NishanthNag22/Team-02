import { parseDate } from './csv-parser';

/**
 * Picks merchant, total and date out of OCR text (FR-16). Pure function – no OCR here.
 * Indian receipts usually print the shop name first and a "Grand Total" / "Net Amount" line near the end.
 */

export interface ReceiptFields { merchant: string | null; amount: number | null; date: string | null }

const NOT_MERCHANT = /^(tax invoice|invoice|receipt|cash memo|bill|gstin|gst|phone|ph|tel|date|time|bill no|order)/i;
const TOTAL_LABELS: [RegExp, number][] = [
  [/grand\s*total/i, 1],
  [/(net|total)\s*(amount|amt|payable)|amount\s*payable|net\s*payable/i, 2],
  [/^\s*total\b/i, 3],
  [/\btotal\b/i, 4],
];
const NUMBER = /(?:₹|rs\.?|inr)?\s*(\d{1,3}(?:,\d{2,3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?)/gi;
const DATE = /(\d{1,2}[/\-.]\d{1,2}[/\-.]\d{2,4}|\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[\s-][A-Za-z]{3,9}[\s-]\d{2,4})/;

function lastNumber(line: string): number | null {
  const all = [...line.matchAll(NUMBER)].map((m) => Number(m[1].replace(/,/g, '')));
  const n = all.filter((x) => Number.isFinite(x) && x > 0).pop();
  return n ?? null;
}

export function extractReceiptFields(text: string): ReceiptFields {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const merchant = lines.find((l) => /[A-Za-z]{3,}/.test(l) && !NOT_MERCHANT.test(l) && !/\d{5,}/.test(l)) ?? null;

  let amount: number | null = null;
  let best = Infinity;
  for (const l of lines) {
    if (/sub\s*-?\s*total/i.test(l)) continue;
    for (const [re, rank] of TOTAL_LABELS) {
      if (re.test(l)) {
        const n = lastNumber(l);
        if (n != null && rank <= best) { amount = n; best = rank; }
        break;
      }
    }
  }
  if (amount == null) {
    // No total label: fall back to the largest amount with paise, e.g. "455.28"
    const money = lines.flatMap((l) => [...l.matchAll(/\d+(?:,\d{2,3})*\.\d{2}/g)].map((m) => Number(m[0].replace(/,/g, ''))));
    amount = money.length ? Math.max(...money) : null;
  }

  let date: string | null = null;
  for (const l of lines) {
    const m = l.match(DATE);
    if (m && (date = parseDate(m[1]))) break;
  }

  return { merchant: merchant ? merchant.replace(/\s{2,}/g, ' ').slice(0, 100) : null, amount, date };
}