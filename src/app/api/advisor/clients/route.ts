import { requireAdvisor } from '@/lib/auth/session';
import { apiError, ok } from '@/lib/api';
import { listClients } from '@/lib/db/advisor';

export const dynamic = 'force-dynamic';

/** GET /api/advisor/clients – my assigned clients with summaries. Advisors only (403 otherwise) (FR-26). */
export async function GET() {
  try {
    const advisor = await requireAdvisor();
    return ok({ clients: await listClients(advisor.id) });
  } catch (err) {
    return apiError(err);
  }
}
