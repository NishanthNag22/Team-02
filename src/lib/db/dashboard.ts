import { query } from './postgres';
import { listLoans } from './loans';
import { markOverdue, upcomingDues } from './dues';

const n = (v: unknown) => Number(v ?? 0);

/** Current totals. Liabilities = outstanding balance of active loans (balance before the next unpaid EMI). */
async function summary(userId: number) {
  const [row] = await query(
    `SELECT
       (SELECT COALESCE(SUM(current_value), 0) FROM assets WHERE user_id = $1) AS total_assets,
       (SELECT COALESCE(SUM(
          (SELECT e.closing_balance + e.principal_component FROM emi_schedule e
            WHERE e.loan_id = l.id AND e.status <> 'paid' ORDER BY e.installment_no LIMIT 1)), 0)
          FROM loans l WHERE l.user_id = $1 AND l.status = 'active') AS total_liabilities,
       (SELECT COALESCE(SUM(current_value), 0) FROM assets WHERE user_id = $1 AND liquidity = 'liquid') AS liquid_assets`,
    [userId],
  );
  const totalAssets = n(row.total_assets);
  const totalLiabilities = n(row.total_liabilities);
  return { totalAssets, totalLiabilities, netWorth: totalAssets - totalLiabilities, liquidAssets: n(row.liquid_assets) };
}

/** Saves today's snapshot (one per day) and returns the trend with month-on-month style change. */
async function trend(userId: number, s: { totalAssets: number; totalLiabilities: number; netWorth: number }) {
  await query(
    `INSERT INTO net_worth_snapshots (user_id, snapshot_date, total_assets, total_liabilities, net_worth)
     VALUES ($1, CURRENT_DATE, $2, $3, $4)
     ON CONFLICT (user_id, snapshot_date)
     DO UPDATE SET total_assets = EXCLUDED.total_assets, total_liabilities = EXCLUDED.total_liabilities, net_worth = EXCLUDED.net_worth`,
    [userId, s.totalAssets, s.totalLiabilities, s.netWorth],
  );
  const rows = await query(
    `SELECT to_char(snapshot_date, 'YYYY-MM-DD') AS date, total_assets, total_liabilities, net_worth,
            net_worth - LAG(net_worth) OVER (ORDER BY snapshot_date) AS change
       FROM net_worth_snapshots WHERE user_id = $1
      ORDER BY snapshot_date DESC LIMIT 365`,
    [userId],
  );
  return rows.reverse().map((r) => ({
    date: String(r.date), assets: n(r.total_assets), liabilities: n(r.total_liabilities),
    netWorth: n(r.net_worth), change: r.change == null ? null : n(r.change),
  }));
}

/** Asset allocation by type with each type's share of the total (window function). */
async function allocation(userId: number) {
  const rows = await query(
    `SELECT asset_type, SUM(current_value) AS value,
            ROUND(100 * SUM(current_value) / NULLIF(SUM(SUM(current_value)) OVER (), 0), 1) AS pct
       FROM assets WHERE user_id = $1
      GROUP BY asset_type ORDER BY value DESC`,
    [userId],
  );
  return rows.map((r) => ({ assetType: String(r.asset_type), value: n(r.value), pct: n(r.pct) }));
}

/** Income vs expense for each of the last 12 months (months with no data show as 0). */
async function cashflow(userId: number) {
  const rows = await query(
    `SELECT to_char(m.month, 'YYYY-MM') AS month,
            COALESCE(SUM(t.amount) FILTER (WHERE t.txn_type = 'income'), 0)  AS income,
            COALESCE(SUM(t.amount) FILTER (WHERE t.txn_type = 'expense'), 0) AS expense
       FROM generate_series(date_trunc('month', CURRENT_DATE) - INTERVAL '11 months',
                            date_trunc('month', CURRENT_DATE), INTERVAL '1 month') AS m(month)
       LEFT JOIN transactions t ON t.user_id = $1 AND date_trunc('month', t.txn_date) = m.month
      GROUP BY m.month ORDER BY m.month`,
    [userId],
  );
  return rows.map((r) => ({ month: String(r.month), income: n(r.income), expense: n(r.expense) }));
}

/** Expense categories seen in at least 3 different months in the last 6 months (HAVING). */
async function recurring(userId: number) {
  const rows = await query(
    `SELECT category, COUNT(DISTINCT date_trunc('month', txn_date)) AS months, ROUND(AVG(amount), 2) AS avg_amount
       FROM transactions
      WHERE user_id = $1 AND txn_type = 'expense' AND txn_date >= date_trunc('month', CURRENT_DATE) - INTERVAL '5 months'
      GROUP BY category
     HAVING COUNT(DISTINCT date_trunc('month', txn_date)) >= 3
      ORDER BY avg_amount DESC`,
    [userId],
  );
  return rows.map((r) => ({ category: String(r.category), months: n(r.months), avgAmount: n(r.avg_amount) }));
}

/** Everything the dashboard needs in one call (FR-18). Independent reads run in parallel. */
export async function getDashboard(userId: number) {
  await markOverdue(userId);
  const s = await summary(userId);
  const [trendRows, mix, loans, dues, flow, rec] = await Promise.all([
    trend(userId, s), allocation(userId), listLoans(userId), upcomingDues(userId, 45, 10), cashflow(userId), recurring(userId),
  ]);
  return { summary: s, trend: trendRows, allocation: mix, loans, dues, cashflow: flow, recurring: rec };
}
