import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { loanSchema } from '@/lib/validation/loans';
import { createLoan, listLoans } from '@/lib/db/loans';
import { apiError, ok } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** GET /api/loans – my loans with payoff summary */
export async function GET() {
  try {
    const user = await requireUser();
    return ok({ loans: await listLoans(user.id) });
  } catch (err) {
    return apiError(err);
  }
}

/** POST /api/loans – create a loan and its full EMI schedule (FR-07) */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const input = loanSchema.parse(await req.json());
    return ok({ loan: await createLoan(user.id, input) }, 201);
  } catch (err) {
    return apiError(err);
  }
}
