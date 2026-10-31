import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { apiError, HttpError, ok, parseId } from '@/lib/api';
import { deleteDocument } from '@/lib/db/documents';

export const dynamic = 'force-dynamic';
type Ctx = { params: { id: string } };

/** DELETE /api/vault/{id} – removes the record and the file (FR-17). Another user's document is 404. */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const user = await requireUser();
    if (!(await deleteDocument(user.id, parseId(params.id)))) throw new HttpError(404, 'Document not found');
    return ok({ deleted: true });
  } catch (err) {
    return apiError(err);
  }
}