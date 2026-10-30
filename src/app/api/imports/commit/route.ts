import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { apiError, ok } from '@/lib/api';
import { commitImport } from '@/lib/db/imports';
import { importCommitSchema } from '@/lib/validation/imports';

export const dynamic = 'force-dynamic';

/** POST /api/imports/commit – saves the confirmed preview rows atomically (FR-14, NFR-03). */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const result = await commitImport(user.id, importCommitSchema.parse(await req.json()));
    return ok(result, 201);
  } catch (err) {
    return apiError(err);
  }
}
