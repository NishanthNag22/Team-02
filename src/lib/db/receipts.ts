import { query } from './postgres';
import { createDocument } from './documents';
import { HttpError } from '@/lib/api';
import type { AllowedType } from '@/lib/services/file-store';
import type { ReceiptConfirm } from '@/lib/validation/receipts';

export const receiptDescription = (merchant: string) => `Receipt – ${merchant.trim()}`;

/**
 * Records the confirmed receipt as an expense (FR-16).
 * The same merchant + amount + date again is refused with 409. Filing the image in the vault is
 * best-effort: if it fails, the expense is still saved and the reply says so.
 */
export async function confirmReceipt(userId: number, r: ReceiptConfirm, image?: { name: string; bytes: Uint8Array; type: AllowedType }) {
  const desc = receiptDescription(r.merchant);
  const dup = await query(
    `SELECT 1 FROM transactions
      WHERE user_id = $1 AND txn_type = 'expense' AND amount = $2 AND txn_date = $3 AND upper(description) = upper($4) LIMIT 1`,
    [userId, r.amount, r.date, desc],
  );
  if (dup.length) throw new HttpError(409, 'This receipt is already recorded.');

  const rows = await query(
    `INSERT INTO transactions (user_id, txn_type, amount, txn_date, category, description)
     VALUES ($1, 'expense', $2, $3, $4, $5) RETURNING id`,
    [userId, r.amount, r.date, r.category, desc],
  );
  const transactionId = Number(rows[0].id);

  let vault: { saved: boolean; documentId?: number; message?: string } = { saved: false };
  if (r.saveToVault && image) {
    try {
      const doc = await createDocument(userId, { title: `${desc} ${r.date}`, tags: ['receipt'] }, image);
      vault = { saved: true, documentId: doc.id };
    } catch (e) {
      vault = { saved: false, message: e instanceof HttpError ? e.message : 'The image could not be filed in the vault.' };
    }
  }
  return { transactionId, vault };
}