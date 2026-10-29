import type { NextRequest } from 'next/server';
import { requireAdvisor } from '@/lib/auth/session';
import { apiError, ok, parseId } from '@/lib/api';
import { clientDetail } from '@/lib/db/advisor';

export const dynamic = 'force-dynamic';
type Ctx = { params: { id: string } };

/** GET /api/advisor/clients/{id} – one assigned client's assets and loans; 403 if not my client (FR-26). */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const advisor = await requireAdvisor();
    return ok(await clientDetail(advisor.id, parseId(params.id)));
  } catch (err) {
    return apiError(err);
  }
}
