import { query } from './postgres';
import type { TransactionFilter, TransactionInput } from '@/lib/validation/transactions';

export interface Transaction {
  id: number;
  txnType: string;
  amount: number;
  txnDate: string;
  category: string;
  description: string | null;
  relatedAssetId: number | null;
  relatedLoanId: number | null;
}

const COLUMNS = `id, txn_type, amount, to_char(txn_date, 'YYYY-MM-DD') AS txn_date, category, description,
  related_asset_id, related_loan_id`;

function toTxn(r: Record<string, unknown>): Transaction {
  return {
    id: Number(r.id),
    txnType: String(r.txn_type),
    amount: Number(r.amount),
    txnDate: String(r.txn_date),
    category: String(r.category),
    description: (r.description as string | null) ?? null,
    relatedAssetId: r.related_asset_id == null ? null : Number(r.related_asset_id),
    relatedLoanId: r.related_loan_id == null ? null : Number(r.related_loan_id),
  };
}

/**
 * Optional filters use ($n IS NULL OR col = $n) so the SQL is never built from strings (SR-06).
 * `search` uses PostgreSQL full-text search: matches word stems ("pharmacy" finds "Pharmacies")
 * and quoted phrases, ranked by relevance (FR-13).
 */
export async function listTransactions(userId: number, f: TransactionFilter): Promise<Transaction[]> {
  const rows = await query(
    `SELECT ${COLUMNS} FROM transactions
      WHERE user_id = $1
        AND ($2::txn_type IS NULL OR txn_type = $2)
        AND ($3::date IS NULL OR txn_date >= $3)
        AND ($4::date IS NULL OR txn_date <= $4)
        AND ($5::text IS NULL OR lower(category) = lower($5))
        AND ($7::text IS NULL OR search_vector @@ websearch_to_tsquery('english', $7))
      ORDER BY CASE WHEN $7::text IS NULL THEN 0
                    ELSE ts_rank(search_vector, websearch_to_tsquery('english', $7)) END DESC,
               txn_date DESC, id DESC
      LIMIT $6`,
    [userId, f.type ?? null, f.from ?? null, f.to ?? null, f.category ?? null, f.limit, f.search ?? null],
  );
  return rows.map(toTxn);
}

export async function createTransaction(userId: number, t: TransactionInput): Promise<Transaction> {
  const rows = await query(
    `INSERT INTO transactions (user_id, txn_type, amount, txn_date, category, description, related_asset_id, related_loan_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING ${COLUMNS}`,
    [userId, t.txnType, t.amount, t.txnDate, t.category, t.description || null, t.relatedAssetId ?? null, t.relatedLoanId ?? null],
  );
  return toTxn(rows[0]);
}

export async function deleteTransaction(userId: number, id: number): Promise<boolean> {
  const rows = await query('DELETE FROM transactions WHERE id = $1 AND user_id = $2 RETURNING id', [id, userId]);
  return rows.length > 0;
}
