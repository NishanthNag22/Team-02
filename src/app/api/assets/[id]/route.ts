import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { assetSchema } from '@/lib/validation/assets';
import { deleteAsset, getAsset, getValuationHistory, updateAsset } from '@/lib/db/assets';
import { apiError, HttpError, ok, parseId } from '@/lib/api';

export const dynamic = 'force-dynamic';
type Ctx = { params: { id: string } };

/** GET /api/assets/{id} – asset with its valuation history (FR-06) */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const user = await requireUser();
    const id = parseId(params.id);
    const asset = await getAsset(user.id, id);
    if (!asset) throw new HttpError(404, 'Asset not found');
    return ok({ asset, valuationHistory: await getValuationHistory(user.id, id) });
  } catch (err) {
    return apiError(err);
  }
}

/** PUT /api/assets/{id} – edit / revalue */
export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const user = await requireUser();
    const id = parseId(params.id);
    const input = assetSchema.parse(await req.json());
    const asset = await updateAsset(user.id, id, input);
    if (!asset) throw new HttpError(404, 'Asset not found');
    return ok({ asset });
  } catch (err) {
    return apiError(err);
  }
}

/** DELETE /api/assets/{id} */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const user = await requireUser();
    if (!(await deleteAsset(user.id, parseId(params.id)))) throw new HttpError(404, 'Asset not found');
    return ok({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
