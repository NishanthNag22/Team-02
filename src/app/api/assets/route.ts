import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { assetSchema } from '@/lib/validation/assets';
import { createAsset, listAssets } from '@/lib/db/assets';
import { apiError, ok } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** GET /api/assets – list my assets (FR-05) */
export async function GET() {
  try {
    const user = await requireUser();
    return ok({ assets: await listAssets(user.id) });
  } catch (err) {
    return apiError(err);
  }
}

/** POST /api/assets – create an asset (FR-05) */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const input = assetSchema.parse(await req.json());
    return ok({ asset: await createAsset(user.id, input) }, 201);
  } catch (err) {
    return apiError(err);
  }
}
