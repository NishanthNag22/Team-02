import type { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth/session';
import { transactionFilterSchema, transactionSchema } from '@/lib/validation/transactions';
import { createTransaction, listTransactions } from '@/lib/db/transactions';
import { apiError, ok } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** GET /api/transactions?type=&from=&to=&category=&limit= (FR-12) */
export async function GET(req: NextRequest) {
  try {
    const user = await requireUser();
    const params = Object.fromEntries([...req.nextUrl.searchParams].filter(([, v]) => v !== ''));
    const filter = transactionFilterSchema.parse(params);
    return ok({ transactions: await listTransactions(user.id, filter) });
  } catch (err) {
    return apiError(err);
  }
}

/** POST /api/transactions (FR-12) */
export async function POST(req: NextRequest) {
  try {
    const user = await requireUser();
    const input = transactionSchema.parse(await req.json());
    return ok({ transaction: await createTransaction(user.id, input) }, 201);
  } catch (err) {
    return apiError(err);
  }
}
