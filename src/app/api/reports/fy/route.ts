import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { apiError, ok } from '@/lib/api';
import { availableYears, fyReport } from '@/lib/db/reports';
import { fyStartYear } from '@/lib/services/fy';

export const dynamic = 'force-dynamic';
const yearSchema = z.coerce.number().int().min(2000).max(2100);

/** GET /api/reports/fy?year=2026 – report for FY 2026-27 (defaults to the current FY) (FR-22). */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const raw = req.nextUrl.searchParams.get('year');
    const year = raw ? yearSchema.parse(raw) : fyStartYear(new Date().toISOString().slice(0, 10));
    const [report, years] = await Promise.all([fyReport(user.id, year), availableYears(user.id)]);
    return ok({ ...report, availableYears: years });
  } catch (err) {
    return apiError(err);
  }
}
