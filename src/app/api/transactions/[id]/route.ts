import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { deleteTransaction } from '@/lib/db/transactions';
import { apiError, HttpError, ok, parseId } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** DELETE /api/transactions/{id} (FR-12) */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    if (!(await deleteTransaction(user.id, parseId(params.id)))) throw new HttpError(404, 'Transaction not found');
    return ok({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}