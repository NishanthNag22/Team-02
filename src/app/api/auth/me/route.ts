import { getCurrentUser } from '@/lib/auth/session';
import { ok } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** GET /api/auth/me – FR-03 */
export async function GET() {
  return ok({ user: await getCurrentUser() });
}
