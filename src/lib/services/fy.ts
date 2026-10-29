/**
 * Indian financial year helpers (FR-22). FY 2026-27 runs from 1 April 2026 to 31 March 2027.
 * A year is identified by its starting calendar year (2026 for FY 2026-27).
 */

/** 2026-03-31 -> 2025 (FY 2025-26); 2026-04-01 -> 2026 (FY 2026-27). */
export function fyStartYear(isoDate: string): number {
  const [y, m] = isoDate.split('-').map(Number);
  return m >= 4 ? y : y - 1;
}

export function fyLabel(startYear: number): string {
  return `FY ${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

export function fyRange(startYear: number): { from: string; to: string } {
  return { from: `${startYear}-04-01`, to: `${startYear + 1}-03-31` };
}

/** Indicative limits (Income-tax Act, old regime) – shown as hints, not tax advice. */
export const TAX_LIMITS = { sec80C: 150000, sec24b: 200000 } as const;

export interface LoanYear { loanType: string; lender: string; principalPaid: number; interestPaid: number }

export interface TaxHint { section: string; title: string; eligibleAmount: number; limit: number | null; claimable: number; note: string }

/** Home-loan principal → 80C, home-loan interest → 24(b), education-loan interest → 80E. */
export function taxHints(loans: LoanYear[]): TaxHint[] {
  const sum = (type: string, key: 'principalPaid' | 'interestPaid') =>
    Math.round(loans.filter((l) => l.loanType === type).reduce((s, l) => s + l[key], 0) * 100) / 100;
  const homePrincipal = sum('home', 'principalPaid');
  const homeInterest = sum('home', 'interestPaid');
  const eduInterest = sum('education', 'interestPaid');
  const hints: TaxHint[] = [];
  if (homePrincipal > 0) hints.push({
    section: '80C', title: 'Home loan principal repaid', eligibleAmount: homePrincipal, limit: TAX_LIMITS.sec80C,
    claimable: Math.min(homePrincipal, TAX_LIMITS.sec80C), note: 'Shared ₹1.5 lakh limit with PPF, EPF, ELSS, life insurance etc.',
  });
  if (homeInterest > 0) hints.push({
    section: '24(b)', title: 'Home loan interest (self-occupied)', eligibleAmount: homeInterest, limit: TAX_LIMITS.sec24b,
    claimable: Math.min(homeInterest, TAX_LIMITS.sec24b), note: 'Limit applies to a self-occupied property.',
  });
  if (eduInterest > 0) hints.push({
    section: '80E', title: 'Education loan interest', eligibleAmount: eduInterest, limit: null,
    claimable: eduInterest, note: 'No upper limit; available for up to 8 years.',
  });
  return hints;
}
