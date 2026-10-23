import { requireUser } from '@/lib/auth/session';
import { getDashboard } from '@/lib/db/dashboard';
import { apiError, ok } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** GET /api/dashboard – summary, trend, allocation, loans, dues, cash flow, recurring (FR-18) */
export async function GET() {
  try {
    const user = await requireUser();
    return ok(await getDashboard(user.id));
  } catch (err) {
    return apiError(err);
  }
}