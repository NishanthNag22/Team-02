import { query } from './postgres';
import { fyLabel, fyRange, fyStartYear, taxHints, type LoanYear } from '@/lib/services/fy';

/** Financial years that have any transaction or paid EMI, newest first, always including the current FY. */
export async function availableYears(userId: number): Promise<number[]> {
  const rows = await query(
    `SELECT DISTINCT (EXTRACT(YEAR FROM d) - CASE WHEN EXTRACT(MONTH FROM d) < 4 THEN 1 ELSE 0 END)::int AS fy
       FROM (SELECT txn_date AS d FROM transactions WHERE user_id = $1
             UNION ALL
             SELECT e.paid_date FROM emi_schedule e JOIN loans l ON l.id = e.loan_id
              WHERE l.user_id = $1 AND e.paid_date IS NOT NULL) x`,
    [userId],
  );
  const years = new Set(rows.map((r) => Number(r.fy)));
  years.add(fyStartYear(new Date().toISOString().slice(0, 10)));
  return [...years].sort((a, b) => b - a);
}

/**
 * FY report (FR-22): income/expense summary, spend by category, EMI principal/interest per loan
 * and indicative tax hints. `to` can be cut short for "FY to date" (used by the PDF statement).
 */
export async function fyReport(userId: number, startYear: number, upTo?: string) {
  const { from, to: fyEnd } = fyRange(startYear);
  const to = upTo && upTo < fyEnd ? upTo : fyEnd;

  const [summary, categories, monthly, loans] = await Promise.all([
    query(
      `SELECT COALESCE(SUM(amount) FILTER (WHERE txn_type = 'income'), 0)  AS income,
              COALESCE(SUM(amount) FILTER (WHERE txn_type = 'expense'), 0) AS expense,
              COALESCE(SUM(amount) FILTER (WHERE txn_type = 'loan'), 0)    AS loan_payments,
              COUNT(*) AS txns
         FROM transactions WHERE user_id = $1 AND txn_date BETWEEN $2 AND $3`,
      [userId, from, to],
    ),
    query(
      `SELECT category, SUM(amount) AS total, COUNT(*) AS n FROM transactions
        WHERE user_id = $1 AND txn_type = 'expense' AND txn_date BETWEEN $2 AND $3
        GROUP BY category ORDER BY total DESC`,
      [userId, from, to],
    ),
    query(
      `SELECT to_char(date_trunc('month', txn_date), 'YYYY-MM') AS month,
              COALESCE(SUM(amount) FILTER (WHERE txn_type = 'income'), 0)  AS income,
              COALESCE(SUM(amount) FILTER (WHERE txn_type = 'expense'), 0) AS expense
         FROM transactions WHERE user_id = $1 AND txn_date BETWEEN $2 AND $3
        GROUP BY 1 ORDER BY 1`,
      [userId, from, to],
    ),
    query(
      `SELECT l.id, l.loan_type, l.lender, COUNT(e.id) AS emis,
              COALESCE(SUM(e.principal_component), 0) AS principal, COALESCE(SUM(e.interest_component), 0) AS interest
         FROM loans l JOIN emi_schedule e ON e.loan_id = l.id
        WHERE l.user_id = $1 AND e.status = 'paid' AND e.paid_date BETWEEN $2 AND $3
        GROUP BY l.id ORDER BY l.id`,
      [userId, from, to],
    ),
  ]);

  const income = Number(summary[0].income);
  const expense = Number(summary[0].expense);
  const totalExpense = expense || 1;
  const loanYears: (LoanYear & { loanId: number; emis: number })[] = loans.map((l) => ({
    loanId: Number(l.id), loanType: String(l.loan_type), lender: String(l.lender), emis: Number(l.emis),
    principalPaid: Number(l.principal), interestPaid: Number(l.interest),
  }));

  return {
    year: startYear,
    label: fyLabel(startYear),
    from, to,
    summary: {
      income, expense, net: Math.round((income - expense) * 100) / 100,
      savingsRatePct: income > 0 ? Math.round(((income - expense) / income) * 1000) / 10 : null,
      loanPayments: Number(summary[0].loan_payments), transactions: Number(summary[0].txns),
    },
    categories: categories.map((c) => ({ category: String(c.category), total: Number(c.total), count: Number(c.n), pct: Math.round((Number(c.total) / totalExpense) * 1000) / 10 })),
    monthly: monthly.map((m) => ({ month: String(m.month), income: Number(m.income), expense: Number(m.expense) })),
    loans: loanYears,
    taxHints: taxHints(loanYears),
    disclaimer: 'Tax hints are indicative only and are not tax advice. Check with a tax professional before filing.',
  };
}
