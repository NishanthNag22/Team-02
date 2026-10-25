import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { getLoan, getSchedule } from '@/lib/db/loans';
import { apiError, HttpError, ok, parseId } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** GET /api/loans/{id}/schedule – full amortisation schedule (FR-08) */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const id = parseId(params.id);
    const loan = await getLoan(user.id, id);
    if (!loan) throw new HttpError(404, 'Loan not found');
    return ok({ loan, schedule: await getSchedule(user.id, id) });
  } catch (err) {
    return apiError(err);
  }
}
