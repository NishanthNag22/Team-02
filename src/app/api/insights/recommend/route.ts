import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { apiError, ok } from '@/lib/api';
import { recommend } from '@/lib/db/loan-products';
import { recommendSchema } from '@/lib/validation/recommend';

export const dynamic = 'force-dynamic';

/** POST /api/insights/recommend {loanType, amount, tenureMonths} – ranked products for my score (FR-20). */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    return ok(await recommend(user.id, recommendSchema.parse(await req.json())));
  } catch (err) {
    return apiError(err);
  }
}
