import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth/session';
import { loanSchema } from '@/lib/validation/loans';
import { deleteLoan, getLoan, setLoanStatus, updateLoan } from '@/lib/db/loans';
import { apiError, HttpError, ok, parseId } from '@/lib/api';

export const dynamic = 'force-dynamic';
type Ctx = { params: { id: string } };

/** GET /api/loans/{id} (FR-08) */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const user = await requireUser();
    const loan = await getLoan(user.id, parseId(params.id));
    if (!loan) throw new HttpError(404, 'Loan not found');
    return ok({ loan });
  } catch (err) {
    return apiError(err);
  }
}

/** PUT /api/loans/{id} – edit terms; 409 if any EMI is already paid (FR-08) */
export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const user = await requireUser();
    const id = parseId(params.id);
    const loan = await updateLoan(user.id, id, loanSchema.parse(await req.json()));
    if (!loan) throw new HttpError(404, 'Loan not found');
    return ok({ loan });
  } catch (err) {
    return apiError(err);
  }
}

const statusSchema = z.object({ status: z.enum(['active', 'closed', 'defaulted']) });

/** PATCH /api/loans/{id} – change status (FR-08) */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const user = await requireUser();
    const id = parseId(params.id);
    const { status } = statusSchema.parse(await req.json());
    if (!(await setLoanStatus(user.id, id, status))) throw new HttpError(404, 'Loan not found');
    return ok({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}

/** DELETE /api/loans/{id} (FR-08) */
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  try {
    const user = await requireUser();
    if (!(await deleteLoan(user.id, parseId(params.id)))) throw new HttpError(404, 'Loan not found');
    return ok({ ok: true });
  } catch (err) {
    return apiError(err);
  }
}
