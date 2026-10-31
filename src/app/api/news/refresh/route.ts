import { requireAdvisor } from '@/lib/auth/session';
import { apiError, ok } from '@/lib/api';
import { refreshNews } from '@/lib/db/news';

export const dynamic = 'force-dynamic';

/** POST /api/news/refresh – advisors only (403 for individuals); 503 if the feed is down (FR-25). */
export async function POST() {
  try {
    await requireAdvisor();
    return ok({ refreshed: await refreshNews() });
  } catch (err) {
    return apiError(err);
  }
}
