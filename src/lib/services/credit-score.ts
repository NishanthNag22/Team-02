/**
 * Derived credit score, 300–900 (FR-19). Uses ONLY WealthWise records.
 * This is NOT a CIBIL, Experian or Equifax score.
 *
 * score = 300 + 600 × Σ weight × factor, every factor between 0 and 1.
 */

export const DISCLAIMER = 'Indicative score derived from your WealthWise records only. It is not a CIBIL, Experian or Equifax credit score.';

export const WEIGHTS = {
  paymentHistory: 0.35,
  debtToAssets: 0.25,
  loanMix: 0.15,
  historyLength: 0.15,
  trackRecord: 0.1,
} as const;

export type FactorKey = keyof typeof WEIGHTS;

export interface ScoreInputs {
  dueInstallments: number;       // installments whose due date has passed
  paidOnTime: number;            // paid on or before the due date
  paidLate: number;              // paid after the due date
  overdue: number;               // due and still unpaid
  totalAssets: number;
  totalLiabilities: number;
  loanTypes: string[];           // one entry per loan
  monthsSinceFirstLoan: number;
  closedLoans: number;
}

export interface Factor { key: FactorKey; label: string; weight: number; value: number; points: number; note: string }

const SECURED = new Set(['home', 'vehicle', 'gold', 'education']);
const clamp = (n: number) => Math.min(1, Math.max(0, n));
const round3 = (n: number) => Math.round(n * 1000) / 1000;

export function computeScore(i: ScoreInputs): { score: number; band: string; factors: Factor[] } {
  const values: Record<FactorKey, [number, string]> = {
    paymentHistory: i.dueInstallments === 0
      ? [0.7, 'No installments due yet']
      : [clamp((i.paidOnTime + 0.6 * i.paidLate - 0.5 * i.overdue) / i.dueInstallments),
         `${i.paidOnTime} on time, ${i.paidLate} late, ${i.overdue} overdue of ${i.dueInstallments} due`],
    debtToAssets: (() => {
      if (i.totalLiabilities === 0) return [1, 'No outstanding debt'] as [number, string];
      if (i.totalAssets === 0) return [0, 'Debt with no recorded assets'] as [number, string];
      const r = i.totalLiabilities / i.totalAssets;
      return [clamp(r <= 0.3 ? 1 : 1 - (r - 0.3) / 1.2), `Debt is ${Math.round(r * 100)}% of assets`] as [number, string];
    })(),
    loanMix: (() => {
      if (i.loanTypes.length === 0) return [0.5, 'No loans recorded'] as [number, string];
      const unsecured = i.loanTypes.filter((t) => !SECURED.has(t)).length / i.loanTypes.length;
      const kinds = new Set(i.loanTypes).size;
      return [clamp(0.4 + 0.2 * kinds - (unsecured > 0.5 ? 0.2 : 0)), `${kinds} loan type(s), ${Math.round(unsecured * 100)}% unsecured`] as [number, string];
    })(),
    historyLength: [clamp(i.monthsSinceFirstLoan / 84), `${i.monthsSinceFirstLoan} months of loan history`],
    trackRecord: [i.loanTypes.length === 0 ? 0.5 : clamp(0.5 + 0.25 * i.closedLoans), `${i.closedLoans} loan(s) fully repaid`],
  };

  const LABELS: Record<FactorKey, string> = {
    paymentHistory: 'Payment history', debtToAssets: 'Debt to assets', loanMix: 'Loan mix',
    historyLength: 'Length of history', trackRecord: 'Track record',
  };

  const factors: Factor[] = (Object.keys(WEIGHTS) as FactorKey[]).map((key) => {
    const [value, note] = values[key];
    return { key, label: LABELS[key], weight: WEIGHTS[key], value: round3(value), points: Math.round(600 * WEIGHTS[key] * value), note };
  });
  const score = Math.round(300 + 600 * factors.reduce((s, f) => s + f.weight * f.value, 0));
  return { score, band: band(score), factors };
}

export function band(score: number): string {
  if (score >= 750) return 'Excellent';
  if (score >= 650) return 'Good';
  if (score >= 550) return 'Fair';
  return 'Poor';
}
