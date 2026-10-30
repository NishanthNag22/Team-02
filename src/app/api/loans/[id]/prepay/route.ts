import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { apiError, ok, parseId } from '@/lib/api';
import { applyPrepayment, listPrepayments } from '@/lib/db/prepayments';
import { prepaySchema } from '@/lib/validation/prepayment';

export const dynamic = 'force-dynamic';
type Ctx = { params: { id: string } };

/** GET /api/loans/{id}/prepay – prepayments made on this loan (FR-11). */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const user = await requireUser();
    return ok({ prepayments: await listPrepayments(user.id, parseId(params.id)) });
  } catch (err) {
    return apiError(err);
  }
}

/** POST /api/loans/{id}/prepay {amount, mode, fundingAssetId?} – apply atomically (FR-11, NFR-03). */
export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const user = await requireUser();
    const result = await applyPrepayment(user.id, parseId(params.id), prepaySchema.parse(await req.json()));
    return ok(result, 201);
  } catch (err) {
    return apiError(err);
  }
}
