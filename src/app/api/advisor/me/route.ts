import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { apiError, HttpError, ok } from '@/lib/api';
import { clearMyAdvisor, getMyAdvisor, setMyAdvisor } from '@/lib/db/advisor';

export const dynamic = 'force-dynamic';

async function individual() {
  const user = await requireUser();
  if (user.role !== 'individual') throw new HttpError(403, 'Only individual users choose an advisor.');
  return user;
}

/** GET /api/advisor/me – my advisor, or null (FR-26). */
export async function GET() {
  try {
    return ok({ advisor: await getMyAdvisor((await individual()).id) });
  } catch (err) {
    return apiError(err);
  }
}

/** PUT /api/advisor/me {email} – choose my advisor. 404 if no advisor has that email. */
export async function PUT(req: NextRequest) {
  try {
    const user = await individual();
    const { email } = z.object({ email: z.string().trim().email() }).parse(await req.json());
    return ok({ advisor: await setMyAdvisor(user.id, email) });
  } catch (err) {
    return apiError(err);
  }
}

/** DELETE /api/advisor/me – stop sharing with my advisor. */
export async function DELETE() {
  try {
    await clearMyAdvisor((await individual()).id);
    return ok({ advisor: null });
  } catch (err) {
    return apiError(err);
  }
}
