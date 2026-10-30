import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { apiError, ok } from '@/lib/api';
import { projectionFor } from '@/lib/db/projection';
import { projectionQuerySchema } from '@/lib/validation/projection';

export const dynamic = 'force-dynamic';

/**
 * GET /api/insights/projection?months=60&growthPct=8&monthlySurplus=25000&closeLoanId=3 (FR-21)
 * months 6–360, growthPct 0–30. closeLoanId must be one of my active loans, otherwise 404.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const params = Object.fromEntries([...req.nextUrl.searchParams].filter(([, v]) => v !== ''));
    return ok(await projectionFor(user.id, projectionQuerySchema.parse(params)));
  } catch (err) {
    return apiError(err);
  }
}
