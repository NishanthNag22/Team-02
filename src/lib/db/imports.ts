import { query, withTransaction } from './postgres';
import { categorize } from './rules';
import { importHash, type ParsedStatement } from '@/lib/services/csv-parser';
import type { ImportCommit } from '@/lib/validation/imports';

export interface PreviewRow {
  rowNumber: number;
  txnDate: string;
  description: string;
  amount: number;
  txnType: 'income' | 'expense';
  category: string;
  matchedKeyword: string | null;
  duplicate: boolean;
}

/** Adds a suggested category and a duplicate flag to every parsed row. Nothing is saved (FR-14 preview). */
export async function previewImport(userId: number, s: ParsedStatement): Promise<PreviewRow[]> {
  const hashes = s.rows.map((r) => r.importHash);
  const existing = await query<{ import_hash: string }>(
    'SELECT import_hash FROM transactions WHERE user_id = $1 AND import_hash = ANY($2::text[])',
    [userId, hashes],
  );
  const seen = new Set(existing.map((e) => e.import_hash));
  const out: PreviewRow[] = [];
  for (const r of s.rows) {
    const c = await categorize(userId, r.description);
    out.push({
      rowNumber: r.rowNumber, txnDate: r.txnDate, description: r.description, amount: r.amount, txnType: r.txnType,
      category: c.category, matchedKeyword: c.keyword, duplicate: seen.has(r.importHash),
    });
  }
  return out;
}

/**
 * Saves the confirmed rows in ONE transaction (NFR-03): either the whole batch is stored or none of it.
 * Duplicates are skipped by the unique index, so importing the same file twice adds nothing.
 */
export async function commitImport(userId: number, c: ImportCommit) {
  return withTransaction(async (client) => {
    const batch = await client.query(
      `INSERT INTO import_batches (user_id, file_name, bank, row_count) VALUES ($1, $2, $3, $4) RETURNING id`,
      [userId, c.fileName, c.bank, c.rows.length],
    );
    const batchId = Number(batch.rows[0].id);
    let inserted = 0;
    for (const r of c.rows) {
      const res = await client.query(
        `INSERT INTO transactions (user_id, txn_type, amount, txn_date, category, description, import_hash, import_batch_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (user_id, import_hash) WHERE import_hash IS NOT NULL DO NOTHING`,
        [userId, r.txnType, r.amount, r.txnDate, r.category, r.description, importHash(r.txnDate, r.amount, r.txnType, r.description), batchId],
      );
      inserted += res.rowCount ?? 0;
    }
    const duplicates = c.rows.length - inserted;
    await client.query('UPDATE import_batches SET inserted = $2, duplicates = $3 WHERE id = $1', [batchId, inserted, duplicates]);
    return { batchId, inserted, duplicates };
  });
}

export async function listBatches(userId: number) {
  const rows = await query(
    `SELECT id, file_name, bank, row_count, inserted, duplicates, created_at FROM import_batches
      WHERE user_id = $1 ORDER BY created_at DESC, id DESC LIMIT 50`,
    [userId],
  );
  return rows.map((r) => ({
    id: Number(r.id), fileName: String(r.file_name), bank: String(r.bank), rowCount: Number(r.row_count),
    inserted: Number(r.inserted), duplicates: Number(r.duplicates), createdAt: new Date(r.created_at as string).toISOString(),
  }));
}
