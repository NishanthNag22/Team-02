/**
 * Loan prepayment maths (FR-11). Pure functions, whole paise, no database.
 *
 * A prepayment is paid just before the next unpaid installment and reduces the outstanding principal.
 *  - reduce_tenure: keep the same EMI, finish earlier.
 *  - reduce_emi:    keep the same end date (same number of installments), lower EMI.
 * The new installments reuse the loan's existing due dates, so the payment calendar never shifts.
 */

export type PrepaymentMode = 'reduce_tenure' | 'reduce_emi';

export interface RemainingInstallment { dueDate: string; emiAmount: number; interestComponent: number }

export interface NewInstallment {
  dueDate: string;
  emiAmount: number;
  principalComponent: number;
  interestComponent: number;
  closingBalance: number;
}

export interface PrepaymentPlan {
  mode: PrepaymentMode;
  outstandingBefore: number;
  outstandingAfter: number;
  emiBefore: number;
  emiAfter: number;
  monthsBefore: number;
  monthsAfter: number;
  interestBefore: number;
  interestAfter: number;
  interestSaved: number;
  schedule: NewInstallment[];
}

const toPaise = (n: number) => Math.round(n * 100);

/** Amortises `balance` paise at monthly rate r with a fixed EMI over the given due dates; last row absorbs rounding. */
function amortise(balance: number, r: number, emiPaise: number, dueDates: string[]): NewInstallment[] {
  const rows: NewInstallment[] = [];
  for (let i = 0; i < dueDates.length && balance > 0; i++) {
    const interest = Math.round(balance * r);
    let principal = emiPaise - interest;
    if (i === dueDates.length - 1 || principal > balance) principal = balance;
    if (principal <= 0) throw new Error('EMI does not cover the interest.');
    balance -= principal;
    rows.push({
      dueDate: dueDates[i],
      emiAmount: (principal + interest) / 100,
      principalComponent: principal / 100,
      interestComponent: interest / 100,
      closingBalance: balance / 100,
    });
  }
  return rows;
}

export function emiFor(balancePaise: number, r: number, months: number): number {
  if (r === 0) return Math.ceil(balancePaise / months);
  const f = Math.pow(1 + r, months);
  return Math.round((balancePaise * r * f) / (f - 1));
}

export function planPrepayment(
  outstanding: number,
  annualRatePct: number,
  remaining: RemainingInstallment[],
  amount: number,
  mode: PrepaymentMode,
): PrepaymentPlan {
  if (remaining.length === 0) throw new Error('Nothing left to prepay.');
  if (!(amount > 0)) throw new Error('Amount must be greater than 0.');
  if (toPaise(amount) >= toPaise(outstanding)) throw new Error('Amount must be less than the outstanding principal.');

  const r = annualRatePct / 12 / 100;
  const balance = toPaise(outstanding) - toPaise(amount);
  const emiBefore = remaining[0].emiAmount;
  const dueDates = remaining.map((x) => x.dueDate);

  const emiPaise = mode === 'reduce_tenure' ? toPaise(emiBefore) : emiFor(balance, r, remaining.length);
  const schedule = amortise(balance, r, emiPaise, dueDates);

  const interestBefore = remaining.reduce((s, x) => s + toPaise(x.interestComponent), 0);
  const interestAfter = schedule.reduce((s, x) => s + toPaise(x.interestComponent), 0);
  return {
    mode,
    outstandingBefore: outstanding,
    outstandingAfter: balance / 100,
    emiBefore,
    emiAfter: schedule[0].emiAmount,
    monthsBefore: remaining.length,
    monthsAfter: schedule.length,
    interestBefore: interestBefore / 100,
    interestAfter: interestAfter / 100,
    interestSaved: (interestBefore - interestAfter) / 100,
    schedule,
  };
}
