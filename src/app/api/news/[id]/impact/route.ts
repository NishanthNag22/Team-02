import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { apiError, ok } from '@/lib/api';
import { articleImpact } from '@/lib/db/news';

export const dynamic = 'force-dynamic';
type Ctx = { params: { id: string } };

/** GET /api/news/{id}/impact – EMI change on my floating-rate loans (FR-25). */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const user = await requireUser();
    return ok(await articleImpact(user.id, params.id));
  } catch (err) {
    return apiError(err);
  }
}
