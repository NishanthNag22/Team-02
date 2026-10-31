import { query } from './postgres';
import { HttpError } from '@/lib/api';
import { removeFile, saveFile, type AllowedType } from '@/lib/services/file-store';
import type { DocumentInput, VaultFilter } from '@/lib/validation/vault';

export interface VaultDocument {
  id: number;
  title: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  tags: string[];
  loanId: number | null;
  assetId: number | null;
  createdAt: string;
}

const COLS = 'id, title, file_name, mime_type, size_bytes, tags, loan_id, asset_id, created_at';
const toDoc = (r: Record<string, unknown>): VaultDocument => ({
  id: Number(r.id), title: String(r.title), fileName: String(r.file_name), mimeType: String(r.mime_type),
  sizeBytes: Number(r.size_bytes), tags: r.tags as string[],
  loanId: r.loan_id == null ? null : Number(r.loan_id), assetId: r.asset_id == null ? null : Number(r.asset_id),
  createdAt: new Date(r.created_at as string).toISOString(),
});

/** A document may only be linked to MY loan or asset (SR-05). */
async function checkLinks(userId: number, d: DocumentInput) {
  if (d.loanId) {
    const r = await query('SELECT 1 FROM loans WHERE id = $1 AND user_id = $2', [d.loanId, userId]);
    if (!r.length) throw new HttpError(422, 'Linked loan not found.');
  }
  if (d.assetId) {
    const r = await query('SELECT 1 FROM assets WHERE id = $1 AND user_id = $2', [d.assetId, userId]);
    if (!r.length) throw new HttpError(422, 'Linked asset not found.');
  }
}

/** Saves the file first, then the row; if the row fails the file is removed again. */
export async function createDocument(userId: number, d: DocumentInput, file: { name: string; bytes: Uint8Array; type: AllowedType }): Promise<VaultDocument> {
  await checkLinks(userId, d);
  const stored = await saveFile(file.bytes, file.type);
  try {
    const rows = await query(
      `INSERT INTO documents (user_id, title, file_name, stored_name, mime_type, size_bytes, tags, loan_id, asset_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING ${COLS}`,
      [userId, d.title, file.name.slice(0, 200), stored, file.type, file.bytes.length, d.tags, d.loanId ?? null, d.assetId ?? null],
    );
    return toDoc(rows[0]);
  } catch (e) {
    await removeFile(stored);
    throw e;
  }
}

export async function listDocuments(userId: number, f: VaultFilter) {
  const rows = await query(
    `SELECT ${COLS} FROM documents
      WHERE user_id = $1
        AND ($2::text IS NULL OR $2 = ANY(tags))
        AND ($3::text IS NULL OR title ILIKE '%' || $3 || '%' OR file_name ILIKE '%' || $3 || '%')
        AND ($4::bigint IS NULL OR loan_id = $4)
        AND ($5::bigint IS NULL OR asset_id = $5)
      ORDER BY created_at DESC, id DESC`,
    [userId, f.tag ?? null, f.q ?? null, f.loanId ?? null, f.assetId ?? null],
  );
  const documents = rows.map(toDoc);
  const byTag: Record<string, number> = {};
  for (const d of documents) for (const t of d.tags) byTag[t] = (byTag[t] ?? 0) + 1;
  return {
    documents,
    stats: { count: documents.length, totalBytes: documents.reduce((s, d) => s + d.sizeBytes, 0), byTag },
  };
}

/** Returns the stored file name only for MY document; otherwise null (→ 404). */
export async function getStoredFile(userId: number, id: number) {
  const rows = await query('SELECT stored_name, file_name, mime_type FROM documents WHERE id = $1 AND user_id = $2', [id, userId]);
  return rows[0] ? { storedName: String(rows[0].stored_name), fileName: String(rows[0].file_name), mimeType: String(rows[0].mime_type) } : null;
}

export async function deleteDocument(userId: number, id: number): Promise<boolean> {
  const rows = await query('DELETE FROM documents WHERE id = $1 AND user_id = $2 RETURNING stored_name', [id, userId]);
  if (!rows[0]) return false;
  await removeFile(String(rows[0].stored_name));
  return true;
}