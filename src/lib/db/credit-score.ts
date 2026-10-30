import { query } from './postgres';
import { markOverdue } from './dues';
import { computeScore, DISCLAIMER, type Factor, type ScoreInputs } from '@/lib/services/credit-score';

/** Collects the five factor inputs from my loans, EMIs and assets. */
export async function scoreInputs(userId: number): Promise<ScoreInputs> {
  const [emi, loans, totals] = await Promise.all([
    query(
      `SELECT COUNT(*) FILTER (WHERE e.due_date <= CURRENT_DATE)                                          AS due,
              COUNT(*) FILTER (WHERE e.due_date <= CURRENT_DATE AND e.status = 'paid' AND e.paid_date <= e.due_date) AS on_time,
              COUNT(*) FILTER (WHERE e.due_date <= CURRENT_DATE AND e.status = 'paid' AND e.paid_date >  e.due_date) AS late,
              COUNT(*) FILTER (WHERE e.due_date <  CURRENT_DATE AND e.status <> 'paid')                     AS overdue
         FROM emi_schedule e JOIN loans l ON l.id = e.loan_id WHERE l.user_id = $1`,
      [userId],
    ),
    query(
      `SELECT loan_type, status, start_date,
              (date_part('year', age(CURRENT_DATE, start_date)) * 12 + date_part('month', age(CURRENT_DATE, start_date)))::int AS months
         FROM loans WHERE user_id = $1`,
      [userId],
    ),
    query(
      `SELECT (SELECT COALESCE(SUM(current_value), 0) FROM assets WHERE user_id = $1) AS assets,
              (SELECT COALESCE(SUM((SELECT e.closing_balance + e.principal_component FROM emi_schedule e
                                     WHERE e.loan_id = l.id AND e.status <> 'paid' ORDER BY e.installment_no LIMIT 1)), 0)
                 FROM loans l WHERE l.user_id = $1 AND l.status = 'active') AS liabilities`,
      [userId],
    ),
  ]);
  return {
    dueInstallments: Number(emi[0].due),
    paidOnTime: Number(emi[0].on_time),
    paidLate: Number(emi[0].late),
    overdue: Number(emi[0].overdue),
    totalAssets: Number(totals[0].assets),
    totalLiabilities: Number(totals[0].liabilities),
    loanTypes: loans.map((l) => String(l.loan_type)),
    monthsSinceFirstLoan: Math.max(0, ...loans.map((l) => Number(l.months))),
    closedLoans: loans.filter((l) => l.status === 'closed').length,
  };
}

/**
 * Computes my score now. A history row is added whenever the score or any factor changed,
 * so paying (or missing) an EMI shows up in the history the next time the score is read (FR-19).
 */
export async function currentScore(userId: number) {
  await markOverdue(userId);
  const result = computeScore(await scoreInputs(userId));

  const last = await query('SELECT score, factors FROM credit_score_history WHERE user_id = $1 ORDER BY computed_at DESC, id DESC LIMIT 1', [userId]);
  // Compare key:value pairs – JSONB does not keep the original key order, so comparing raw JSON text would always differ.
  const signature = (fs: { key: string; value: number }[]) => fs.map((f) => `${f.key}:${f.value}`).join('|');
  if (!last[0] || Number(last[0].score) !== result.score || signature(last[0].factors as Factor[]) !== signature(result.factors)) {
    await query('INSERT INTO credit_score_history (user_id, score, factors) VALUES ($1, $2, $3::jsonb)', [userId, result.score, JSON.stringify(result.factors)]);
  }
  const history = await query(
    `SELECT score, to_char(computed_at, 'YYYY-MM-DD') AS day FROM credit_score_history
      WHERE user_id = $1 ORDER BY computed_at DESC, id DESC LIMIT 24`,
    [userId],
  );
  return {
    ...result,
    disclaimer: DISCLAIMER,
    history: history.reverse().map((h) => ({ date: String(h.day), score: Number(h.score) })),
  };
}
