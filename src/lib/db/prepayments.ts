import type { PoolClient } from 'pg';
import { getPool, query, withTransaction } from './postgres';
import { HttpError } from '@/lib/api';
import { planPrepayment, type PrepaymentMode, type RemainingInstallment } from '@/lib/services/prepayment';
import type { PrepayInput } from '@/lib/validation/prepayment';

type Runner = Pick<PoolClient, 'query'>;

interface LoanState {
  lender: string;
  rate: number;
  outstanding: number;
  firstUnpaidNo: number;
  remaining: RemainingInstallment[];
}

/** Loads my active loan and its unpaid installments. `lock` = FOR UPDATE inside a transaction. */
async function loadLoan(db: Runner, userId: number, loanId: number, lock: boolean): Promise<LoanState> {
  const loan = await db.query(
    `SELECT lender, interest_rate, status FROM loans WHERE id = $1 AND user_id = $2 ${lock ? 'FOR UPDATE' : ''}`,
    [loanId, userId],
  );
  if (loan.rows.length === 0) throw new HttpError(404, 'Loan not found');
  if (loan.rows[0].status !== 'active') throw new HttpError(422, 'Only an active loan can be prepaid.');

  const rows = await db.query(
    `SELECT installment_no, to_char(due_date, 'YYYY-MM-DD') AS due_date, emi_amount, interest_component,
            principal_component, closing_balance
       FROM emi_schedule WHERE loan_id = $1 AND status <> 'paid' ORDER BY installment_no`,
    [loanId],
  );
  if (rows.rows.length === 0) throw new HttpError(422, 'This loan has no unpaid installments.');
  const first = rows.rows[0];
  return {
    lender: String(loan.rows[0].lender),
    rate: Number(loan.rows[0].interest_rate),
    outstanding: Math.round((Number(first.closing_balance) + Number(first.principal_component)) * 100) / 100,
    firstUnpaidNo: Number(first.installment_no),
    remaining: rows.rows.map((r) => ({ dueDate: String(r.due_date), emiAmount: Number(r.emi_amount), interestComponent: Number(r.interest_component) })),
  };
}

function plan(s: LoanState, amount: number, mode: PrepaymentMode) {
  try {
    return planPrepayment(s.outstanding, s.rate, s.remaining, amount, mode);
  } catch (e) {
    throw new HttpError(422, (e as Error).message);
  }
}

/** Compares both options without saving anything (FR-11). */
export async function simulatePrepayment(userId: number, loanId: number, amount: number) {
  const s = await loadLoan(getPool(), userId, loanId, false);
  const summary = (m: PrepaymentMode) => {
    const { schedule, ...rest } = plan(s, amount, m);
    return { ...rest, lastDueDate: schedule[schedule.length - 1].dueDate };
  };
  return { loanId, outstanding: s.outstanding, reduceTenure: summary('reduce_tenure'), reduceEmi: summary('reduce_emi') };
}

/**
 * Applies a prepayment in ONE transaction (NFR-03): optional asset deduction, new schedule for the
 * unpaid installments, a ledger entry and the prepayment record. Any failure rolls everything back.
 */
export async function applyPrepayment(userId: number, loanId: number, input: PrepayInput) {
  return withTransaction(async (client) => {
    const s = await loadLoan(client, userId, loanId, true);
    const p = plan(s, input.amount, input.mode);

    if (input.fundingAssetId) {
      const a = await client.query('SELECT current_value FROM assets WHERE id = $1 AND user_id = $2 FOR UPDATE', [input.fundingAssetId, userId]);
      if (a.rows.length === 0) throw new HttpError(422, 'Funding asset not found.');
      if (Number(a.rows[0].current_value) < input.amount) throw new HttpError(422, 'The funding asset is worth less than the prepayment.');
      const upd = await client.query(
        `UPDATE assets SET current_value = current_value - $2, valuation_date = GREATEST(CURRENT_DATE, purchase_date)
          WHERE id = $1 RETURNING current_value, valuation_date`,
        [input.fundingAssetId, input.amount],
      );
      await client.query(
        `INSERT INTO asset_valuations (asset_id, valuation_date, value, source) VALUES ($1, $2, $3, 'revaluation')`,
        [input.fundingAssetId, upd.rows[0].valuation_date, upd.rows[0].current_value],
      );
    }

    await client.query("DELETE FROM emi_schedule WHERE loan_id = $1 AND status <> 'paid'", [loanId]);
    await client.query(
      `INSERT INTO emi_schedule (loan_id, installment_no, due_date, emi_amount, principal_component, interest_component, closing_balance)
       SELECT $1, $2 + t.ord - 1, t.due::date, t.emi, t.principal, t.interest, t.balance
         FROM UNNEST($3::text[], $4::numeric[], $5::numeric[], $6::numeric[], $7::numeric[])
              WITH ORDINALITY AS t(due, emi, principal, interest, balance, ord)`,
      [
        loanId, s.firstUnpaidNo,
        p.schedule.map((x) => x.dueDate), p.schedule.map((x) => x.emiAmount), p.schedule.map((x) => x.principalComponent),
        p.schedule.map((x) => x.interestComponent), p.schedule.map((x) => x.closingBalance),
      ],
    );
    await client.query(
      `UPDATE loans SET tenure_months = (SELECT max(installment_no) FROM emi_schedule WHERE loan_id = $1) WHERE id = $1`,
      [loanId],
    );

    await client.query(
      `INSERT INTO transactions (user_id, txn_type, amount, txn_date, category, description, related_loan_id, related_asset_id)
       VALUES ($1, 'loan', $2, CURRENT_DATE, 'Prepayment', $3, $4, $5)`,
      [userId, input.amount, `Prepayment – ${s.lender} (${input.mode === 'reduce_tenure' ? 'reduce tenure' : 'reduce EMI'})`, loanId, input.fundingAssetId ?? null],
    );

    const rec = await client.query(
      `INSERT INTO loan_prepayments (loan_id, user_id, amount, mode, funded_from_asset_id, outstanding_before, outstanding_after,
                                     emi_before, emi_after, months_before, months_after, interest_saved)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
      [loanId, userId, input.amount, input.mode, input.fundingAssetId ?? null, p.outstandingBefore, p.outstandingAfter,
        p.emiBefore, p.emiAfter, p.monthsBefore, p.monthsAfter, p.interestSaved],
    );
    const { schedule, ...rest } = p;
    return { prepaymentId: Number(rec.rows[0].id), loanId, ...rest, installmentsAfter: schedule.length };
  });
}

export async function listPrepayments(userId: number, loanId: number) {
  const rows = await query(
    `SELECT id, amount, mode, to_char(prepaid_on, 'YYYY-MM-DD') AS prepaid_on, interest_saved, emi_after, months_after
       FROM loan_prepayments WHERE loan_id = $1 AND user_id = $2 ORDER BY id`,
    [loanId, userId],
  );
  return rows.map((r) => ({
    id: Number(r.id), amount: Number(r.amount), mode: String(r.mode), prepaidOn: String(r.prepaid_on),
    interestSaved: Number(r.interest_saved), emiAfter: Number(r.emi_after), monthsAfter: Number(r.months_after),
  }));
}
