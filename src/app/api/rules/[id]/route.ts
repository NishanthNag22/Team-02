import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { deleteRule } from '@/lib/db/rules';
import { apiError, ok, parseId } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** DELETE /api/rules/{id} – delete one of my rules (system rules cannot be deleted) */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    await deleteRule(user.id, parseId(params.id));
    return ok({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
