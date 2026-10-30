import { createHash } from 'node:crypto';

/**
 * Bank statement CSV parsing (FR-14).
 * Indian banks use different layouts (HDFC "Withdrawal Amt."/"Deposit Amt.", ICICI "Debit"/"Credit", …)
 * and often put account details above the header, so columns are found by name, not position.
 */

export interface ParsedRow {
  rowNumber: number;
  txnDate: string;            // YYYY-MM-DD
  description: string;
  amount: number;
  txnType: 'income' | 'expense';
  importHash: string;
}
export interface RejectedRow { rowNumber: number; reason: string; raw: string }
export interface ParsedStatement { bank: string; rows: ParsedRow[]; rejected: RejectedRow[] }

/** RFC 4180 CSV reader: handles quoted fields, commas inside quotes and "" escapes. */
export function readCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^﻿/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows.map((r) => r.map((f) => f.trim())).filter((r) => r.some((f) => f !== ''));
}

const ALIASES = {
  date: ['date', 'txn date', 'transaction date', 'value date', 'value dt', 'tran date'],
  description: ['narration', 'description', 'particulars', 'transaction remarks', 'remarks', 'details'],
  debit: ['withdrawal amt.', 'withdrawal amt', 'withdrawal', 'withdrawal amount', 'debit', 'debit amount', 'dr'],
  credit: ['deposit amt.', 'deposit amt', 'deposit', 'deposit amount', 'credit', 'credit amount', 'cr'],
  amount: ['amount', 'transaction amount'],
  type: ['dr/cr', 'cr/dr', 'type', 'transaction type'],
};
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

function findColumn(header: string[], names: string[]): number {
  const h = header.map(norm);
  return h.findIndex((c) => names.includes(c));
}

/** Finds the first row that has a date column, a description column and some amount column. */
export function findHeader(rows: string[][]) {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const r = rows[i];
    const cols = {
      date: findColumn(r, ALIASES.date),
      description: findColumn(r, ALIASES.description),
      debit: findColumn(r, ALIASES.debit),
      credit: findColumn(r, ALIASES.credit),
      amount: findColumn(r, ALIASES.amount),
      type: findColumn(r, ALIASES.type),
    };
    if (cols.date >= 0 && cols.description >= 0 && (cols.debit >= 0 || cols.credit >= 0 || cols.amount >= 0)) {
      return { index: i, cols };
    }
  }
  throw new Error('Could not find a header row with Date, Description/Narration and amount columns.');
}

const MONTHS: Record<string, number> = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

/** Indian statements are day-first: 05/03/2026 is 5 March. Returns null for impossible dates like 31/02. */
export function parseDate(raw: string): string | null {
  const s = raw.trim();
  let y: number, m: number, d: number;
  let match;
  if ((match = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) { y = +match[1]; m = +match[2]; d = +match[3]; }
  else if ((match = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2}|\d{4})$/))) {
    d = +match[1]; m = +match[2]; y = +match[3]; if (y < 100) y += 2000;
  } else if ((match = s.match(/^(\d{1,2})[\s-]([A-Za-z]{3})[A-Za-z]*[\s-](\d{2}|\d{4})$/))) {
    d = +match[1]; m = MONTHS[match[2].toLowerCase()] ?? 0; y = +match[3]; if (y < 100) y += 2000;
  } else return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

/** "1,65,000.00" -> 165000; "" -> null; also strips ₹ and Cr/Dr suffixes. */
export function parseAmount(raw: string | undefined): number | null {
  if (!raw) return null;
  const s = raw.replace(/[₹,\s]/g, '').replace(/(cr|dr)$/i, '');
  if (s === '' || s === '-' || s === '0' || s === '0.00') return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.abs(Math.round(n * 100) / 100) : null;
}

/** Same date + amount + type + description always gives the same 32-character hash, so re-imports are detected. */
export function importHash(txnDate: string, amount: number, txnType: string, description: string): string {
  const key = `${txnDate}|${amount.toFixed(2)}|${txnType}|${description.toUpperCase().replace(/\s+/g, ' ').trim()}`;
  return createHash('md5').update(key).digest('hex');
}

export function detectBank(fileName: string, text: string): string {
  const s = `${fileName} ${text.slice(0, 800)}`.toUpperCase();
  for (const b of ['HDFC', 'ICICI', 'SBI', 'AXIS', 'KOTAK']) if (s.includes(b)) return b;
  return 'Other';
}

export function parseStatement(fileName: string, text: string): ParsedStatement {
  const rows = readCsv(text);
  const { index, cols } = findHeader(rows);
  const parsed: ParsedRow[] = [];
  const rejected: RejectedRow[] = [];

  for (let i = index + 1; i < rows.length; i++) {
    const r = rows[i];
    const rowNumber = i + 1;
    const raw = r.join(', ');
    const date = parseDate(r[cols.date] ?? '');
    if (!date) { rejected.push({ rowNumber, raw, reason: `Invalid date "${r[cols.date] ?? ''}"` }); continue; }
    const description = (r[cols.description] ?? '').trim();
    if (!description) { rejected.push({ rowNumber, raw, reason: 'Missing description' }); continue; }

    let amount: number | null = null;
    let txnType: 'income' | 'expense' | null = null;
    const debit = cols.debit >= 0 ? parseAmount(r[cols.debit]) : null;
    const credit = cols.credit >= 0 ? parseAmount(r[cols.credit]) : null;
    if (debit) { amount = debit; txnType = 'expense'; }
    else if (credit) { amount = credit; txnType = 'income'; }
    else if (cols.amount >= 0) {
      amount = parseAmount(r[cols.amount]);
      const t = (cols.type >= 0 ? r[cols.type] : r[cols.amount] ?? '').toLowerCase();
      txnType = t.includes('cr') ? 'income' : 'expense';
    }
    if (!amount || !txnType) { rejected.push({ rowNumber, raw, reason: 'No withdrawal or deposit amount' }); continue; }

    parsed.push({ rowNumber, txnDate: date, description, amount, txnType, importHash: importHash(date, amount, txnType, description) });
  }
  return { bank: detectBank(fileName, text), rows: parsed, rejected };
}
