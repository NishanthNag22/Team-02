import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { payInstallment } from '@/lib/db/loans';
import { apiError, HttpError, ok, parseId } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** POST /api/emi/{id}/pay – mark one installment paid (FR-09) */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const result = await payInstallment(user.id, parseId(params.id));
    if (!result) throw new HttpError(404, 'Installment not found, not yours, or already paid.');
    return ok(result);
  } catch (err) {
    return apiError(err);
  }
}
