import { requireUser } from '@/lib/auth/session';
import { apiError, ok } from '@/lib/api';
import { currentScore } from '@/lib/db/credit-score';

export const dynamic = 'force-dynamic';

/** GET /api/insights/score – derived score 300–900 with factor breakdown and history (FR-19). Not a bureau score. */
export async function GET() {
  try {
    const user = await requireUser();
    return ok(await currentScore(user.id));
  } catch (err) {
    return apiError(err);
  }
}
