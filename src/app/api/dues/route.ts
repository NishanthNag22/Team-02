import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { markOverdue, upcomingDues } from '@/lib/db/dues';
import { apiError, ok } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** GET /api/dues?days=45 – overdue and upcoming EMIs (FR-10). Past-due installments are marked overdue first. */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const days = Math.min(Math.max(Number(req.nextUrl.searchParams.get('days') ?? 45) || 45, 1), 365);
    const markedOverdue = await markOverdue(user.id);
    return ok({ markedOverdue, dues: await upcomingDues(user.id, days) });
  } catch (err) {
    return apiError(err);
  }
}