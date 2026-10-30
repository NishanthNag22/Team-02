import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { apiError, ok, parseId } from '@/lib/api';
import { simulatePrepayment } from '@/lib/db/prepayments';
import { simulateSchema } from '@/lib/validation/prepayment';

export const dynamic = 'force-dynamic';
type Ctx = { params: { id: string } };

/** POST /api/loans/{id}/prepay/simulate {amount} – compare reduce-tenure vs reduce-EMI; saves nothing (FR-11). */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const user = await requireUser();
    const { amount } = simulateSchema.parse(await req.json());
    return ok(await simulatePrepayment(user.id, parseId(params.id), amount));
  } catch (err) {
    return apiError(err);
  }
}
