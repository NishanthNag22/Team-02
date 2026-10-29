import { query } from './postgres';
import { getDashboard } from './dashboard';
import { listAssets } from './assets';
import { listLoans } from './loans';
import { fyReport } from './reports';
import { fyStartYear } from '@/lib/services/fy';
import type { StatementData } from '@/lib/services/pdf-statement';

/** Gathers everything the PDF needs for one user (FR-23). */
export async function statementData(userId: number): Promise<StatementData> {
  const today = new Date().toISOString().slice(0, 10);
  const [user, dash, assets, loans, months, fy] = await Promise.all([
    query('SELECT name, email, pan_number FROM users WHERE id = $1', [userId]),
    getDashboard(userId),
    listAssets(userId),
    listLoans(userId),
    query(
      `SELECT DISTINCT ON (date_trunc('month', snapshot_date)) to_char(snapshot_date, 'YYYY-MM') AS month, net_worth
         FROM net_worth_snapshots
        WHERE user_id = $1 AND snapshot_date > CURRENT_DATE - interval '12 months'
        ORDER BY date_trunc('month', snapshot_date), snapshot_date DESC`,
      [userId],
    ),
    fyReport(userId, fyStartYear(today), today),
  ]);
  return {
    name: String(user[0].name),
    email: String(user[0].email),
    pan: (user[0].pan_number as string | null) ?? null,
    generatedOn: today,
    summary: dash.summary,
    assets: assets.map((a) => ({ name: a.name, assetType: a.assetType, currentValue: a.currentValue, valuationDate: a.valuationDate })),
    loans: loans.filter((l) => l.status === 'active').map((l) => ({ lender: l.lender, loanType: l.loanType, interestRate: l.interestRate, emiAmount: l.emiAmount, outstanding: l.outstanding })),
    netWorthByMonth: months.map((m) => ({ month: String(m.month), netWorth: Number(m.net_worth) })),
    fyToDate: { label: fy.label, from: fy.from, to: fy.to, income: fy.summary.income, expense: fy.summary.expense, net: fy.summary.net },
  };
}
