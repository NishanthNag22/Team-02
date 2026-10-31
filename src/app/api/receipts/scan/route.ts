import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { apiError, ok } from '@/lib/api';
import { categorize } from '@/lib/db/rules';
import { scanReceipt } from '@/lib/services/ocr';
import { readUpload } from '@/lib/services/upload';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_RECEIPT_BYTES = 8 * 1024 * 1024;

/** POST /api/receipts/scan – multipart "file" (JPEG/PNG/WebP ≤ 8 MB). Reads the receipt; saves nothing (FR-16). */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const file = await readUpload(await req.formData().catch(() => null), MAX_RECEIPT_BYTES, ['image/jpeg', 'image/png', 'image/webp'], 'JPEG, PNG or WebP');
    const result = await scanReceipt(file.bytes);
    const guess = result.merchant ? await categorize(user.id, result.merchant) : null;
    return ok({ ...result, suggestedCategory: guess && guess.category !== 'Uncategorized' ? guess.category : 'Shopping' });
  } catch (err) {
    return apiError(err);
  }
}