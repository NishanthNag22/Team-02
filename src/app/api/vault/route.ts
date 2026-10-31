import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { apiError, ok } from '@/lib/api';
import { createDocument, listDocuments } from '@/lib/db/documents';
import { ALLOWED_TYPES } from '@/lib/services/file-store';
import { readUpload } from '@/lib/services/upload';
import { documentSchema, MAX_VAULT_BYTES, vaultFilterSchema } from '@/lib/validation/vault';

export const dynamic = 'force-dynamic';

/** GET /api/vault?tag=&q=&loanId=&assetId= – my documents with summary stats (FR-17). */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const filter = vaultFilterSchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    return ok(await listDocuments(user.id, filter));
  } catch (err) {
    return apiError(err);
  }
}

/** POST /api/vault – multipart: file (PDF/JPEG/PNG/WebP ≤ 10 MB), title, tags, loanId?, assetId? (FR-17). */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const form = await req.formData().catch(() => null);
    const file = await readUpload(form, MAX_VAULT_BYTES, ALLOWED_TYPES, 'PDF, JPEG, PNG or WebP');
    const input = documentSchema.parse({
      title: form?.get('title') ?? '', tags: form?.get('tags') ?? '', loanId: form?.get('loanId'), assetId: form?.get('assetId'),
    });
    return ok({ document: await createDocument(user.id, input, file) }, 201);
  } catch (err) {
    return apiError(err);
  }
}