import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { apiError, ok } from '@/lib/api';
import { listNews } from '@/lib/db/news';

export const dynamic = 'force-dynamic';
const categorySchema = z.enum(['Monetary Policy', 'Banking', 'Regulation', 'Markets', 'Other']).optional();

/** GET /api/news?category= – RBI press releases, cached; sample articles if unavailable (FR-25). */
export async function GET(req: NextRequest) {
  try {
    await requireUser();
    return ok(await listNews(categorySchema.parse(req.nextUrl.searchParams.get('category') || undefined)));
  } catch (err) {
    return apiError(err);
  }
}
