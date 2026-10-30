/**
 * What-if net worth projection (FR-21). Pure function – no database – so it is easy to test.
 *
 * Each month: assets grow by growthPct/12 %, then the month's cash is added
 * (monthly surplus minus the EMIs still being paid). Liabilities follow each loan's EMI schedule.
 * "Close a loan now" pays its outstanding from assets at month 0, and that EMI is no longer paid.
 */

export interface ProjectionLoan {
  id: number;
  lender: string;
  outstanding: number;
  /** remaining unpaid installments in order */
  schedule: { emi: number; closingBalance: number }[];
}

export interface ProjectionInput {
  assets: number;
  monthlySurplus: number;
  growthPct: number;
  months: number;
  loans: ProjectionLoan[];
  closeLoanId?: number;
}

export interface ProjectionPoint { month: number; assets: number; liabilities: number; netWorth: number }

const r2 = (n: number) => Math.round(n * 100) / 100;

export function projectNetWorth(input: ProjectionInput): ProjectionPoint[] {
  const g = input.growthPct / 12 / 100;
  const closed = input.loans.find((l) => l.id === input.closeLoanId);
  const loans = input.loans.filter((l) => l !== closed);
  let assets = input.assets - (closed?.outstanding ?? 0);

  const liabilitiesAt = (t: number) =>
    loans.reduce((sum, l) => sum + (t === 0 ? l.outstanding : (l.schedule[t - 1]?.closingBalance ?? 0)), 0);

  const points: ProjectionPoint[] = [{ month: 0, assets: r2(assets), liabilities: r2(liabilitiesAt(0)), netWorth: r2(assets - liabilitiesAt(0)) }];
  for (let t = 1; t <= input.months; t++) {
    const emis = loans.reduce((sum, l) => sum + (l.schedule[t - 1]?.emi ?? 0), 0);
    assets = assets * (1 + g) + input.monthlySurplus - emis;
    const liabilities = liabilitiesAt(t);
    points.push({ month: t, assets: r2(assets), liabilities: r2(liabilities), netWorth: r2(assets - liabilities) });
  }
  return points;
}

/** Interest still to be paid on a loan = remaining EMIs − outstanding principal. */
export function remainingInterest(loan: ProjectionLoan): number {
  return r2(loan.schedule.reduce((s, i) => s + i.emi, 0) - loan.outstanding);
}
