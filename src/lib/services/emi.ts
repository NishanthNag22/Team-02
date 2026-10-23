/**
 * Reducing-balance EMI maths (FR-07, NFR-02).
 * All arithmetic is done in whole paise (integers), so there is no floating-point drift.
 */

export interface Installment {
  installmentNo: number;
  dueDate: string;          // YYYY-MM-DD
  emiAmount: number;        // rupees, 2 decimals
  principalComponent: number;
  interestComponent: number;
  closingBalance: number;
}

/** EMI = P·r·(1+r)^n / ((1+r)^n − 1), r = annual rate / 12 / 100. Returns rupees rounded to paise. */
export function calculateEmi(principal: number, annualRatePct: number, months: number): number {
  const r = annualRatePct / 12 / 100;
  if (r === 0) return Math.round((principal / months) * 100) / 100;
  const f = Math.pow(1 + r, months);
  return Math.round(((principal * r * f) / (f - 1)) * 100) / 100;
}

/** Adds n months to a YYYY-MM-DD date, clamping to the last day of the month (31 Jan + 1 → 28/29 Feb). */
export function addMonths(isoDate: string, n: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const target = new Date(Date.UTC(y, m - 1 + n, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

/** Full schedule; the last installment absorbs rounding so the closing balance is exactly 0.00. */
export function generateSchedule(principal: number, annualRatePct: number, months: number, startDate: string): Installment[] {
  const r = annualRatePct / 12 / 100;
  const emiPaise = Math.round(calculateEmi(principal, annualRatePct, months) * 100);
  let balance = Math.round(principal * 100);
  const rows: Installment[] = [];

  for (let i = 1; i <= months; i++) {
    const interest = Math.round(balance * r);
    let principalPart = emiPaise - interest;
    if (i === months || principalPart > balance) principalPart = balance;
    balance -= principalPart;
    rows.push({
      installmentNo: i,
      dueDate: addMonths(startDate, i),
      emiAmount: (principalPart + interest) / 100,
      principalComponent: principalPart / 100,
      interestComponent: interest / 100,
      closingBalance: balance / 100,
    });
    if (balance === 0) break;
  }
  return rows;
}
