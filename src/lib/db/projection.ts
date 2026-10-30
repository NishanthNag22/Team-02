import { query } from './postgres';
import { HttpError } from '@/lib/api';
import { projectNetWorth, remainingInterest, type ProjectionLoan } from '@/lib/services/projection';
import type { ProjectionQuery } from '@/lib/validation/projection';

/** Average (income − expense) over the last 3 complete months; used when the user gives no surplus. */
export async function averageMonthlySurplus(userId: number): Promise<number> {
  const rows = await query(
    `SELECT COALESCE(SUM(CASE WHEN txn_type = 'income' THEN amount WHEN txn_type = 'expense' THEN -amount ELSE 0 END), 0) / 3 AS s
       FROM transactions
      WHERE user_id = $1

AND txn_date >= date_trunc('month', CURRENT_DATE) - interval '3 months'
        AND txn_date <  date_trunc('month', CURRENT_DATE)`,
    [userId],
  );
  return Math.round(Number(rows[0].s) * 100) / 100;
}

/** Active loans with their remaining (unpaid) installments. Outstanding = balance before the next unpaid EMI. */
export async function activeLoansForProjection(userId: number): Promise<ProjectionLoan[]> {
  const rows = await query(
    `SELECT l.id, l.lender, e.emi_amount, e.closing_balance, e.principal_component
       FROM loans l JOIN emi_schedule e ON e.loan_id = l.id
      WHERE l.user_id = $1 AND l.status = 'active' AND e.status <> 'paid'
      ORDER BY l.id, e.installment_no`,
    [userId],
  );
  const byId = new Map<number, ProjectionLoan>();
  for (const r of rows) {
    const id = Number(r.id);
    let loan = byId.get(id);
    if (!loan) {
      loan = { id, lender: String(r.lender), outstanding: Number(r.closing_balance) + Number(r.principal_component), schedule: [] };
      byId.set(id, loan);
    }
    loan.schedule.push({ emi: Number(r.emi_amount), closingBalance: Number(r.closing_balance) });
  }
  return [...byId.values()];
}

export async function projectionFor(userId: number, q: ProjectionQuery) {
  const [assetsRow, loans, avg] = await Promise.all([
    query('SELECT COALESCE(SUM(current_value), 0) AS total FROM assets WHERE user_id = $1', [userId]),
    activeLoansForProjection(userId),
    q.monthlySurplus === undefined ? averageMonthlySurplus(userId) : Promise.resolve(q.monthlySurplus),
  ]);
  const closeLoan = q.closeLoanId ? loans.find((l) => l.id === q.closeLoanId) : undefined;
  if (q.closeLoanId && !closeLoan) throw new HttpError(404, 'Loan not found.');

  const input = { assets: Number(assetsRow[0].total), monthlySurplus: avg, growthPct: q.growthPct, months: q.months, loans };
  const baseline = projectNetWorth(input);
  const scenario = closeLoan ? projectNetWorth({ ...input, closeLoanId: closeLoan.id }) : null;
  return {
    assumptions: { months: q.months, growthPct: q.growthPct, monthlySurplus: avg, surplusSource: q.monthlySurplus === undefined ? 'last 3 months' : 'entered' },
    loans: loans.map((l) => ({ id: l.id, lender: l.lender, outstanding: l.outstanding, remainingInterest: remainingInterest(l) })),
    baseline,
    scenario: scenario && closeLoan ? {
      closeLoanId: closeLoan.id,
      lender: closeLoan.lender,
      points: scenario,
      difference: Math.round((scenario[q.months].netWorth - baseline[q.months].netWorth) * 100) / 100,
    } : null,
  };
}
