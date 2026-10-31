import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { apiError, ok } from '@/lib/api';
import { confirmReceipt } from '@/lib/db/receipts';
import { readUpload } from '@/lib/services/upload';
import { receiptConfirmSchema } from '@/lib/validation/receipts';

export const dynamic = 'force-dynamic';

/**
 * POST /api/receipts/confirm – multipart: merchant, amount, date, category, saveToVault, file (optional).
 * 201 with the new transaction; 409 if the same receipt was already confirmed (FR-16).
 */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const form = await req.formData().catch(() => null);
    const input = receiptConfirmSchema.parse(Object.fromEntries(form ? [...form.entries()].filter(([k]) => k !== 'file') : []));
    const image = input.saveToVault && form?.get('file') instanceof File
      ? await readUpload(form, 8 * 1024 * 1024, ['image/jpeg', 'image/png', 'image/webp'], 'JPEG, PNG or WebP')
      : undefined;
    return ok(await confirmReceipt(user.id, input, image), 201);
  } catch (err) {
    return apiError(err);
  }
}