import { requireUser } from '@/lib/auth/session';
import { apiError, ok } from '@/lib/api';
import { listBatches } from '@/lib/db/imports';

export const dynamic = 'force-dynamic';

/** GET /api/imports/batches – my import history (FR-14). */
export async function GET() {
  try {
    const user = await requireUser();
    return ok({ batches: await listBatches(user.id) });
  } catch (err) {
    return apiError(err);
  }
}
