import type { PoolClient } from 'pg';
import { query, withTransaction } from './postgres';
import { HttpError } from '@/lib/api';
import { generateSchedule } from '@/lib/services/emi';
import type { LoanInput } from '@/lib/validation/loans';

export interface LoanSummary {
  id: number;
  loanType: string;
  lender: string;
  principal: number;
  interestRate: number;
  interestType: string;
  tenureMonths: number;
  startDate: string;
  status: string;
  emiAmount: number;
  paidCount: number;
  outstanding: number;
  nextDueDate: string | null;
}

const SUMMARY_SQL = `
  SELECT l.id, l.loan_type, l.lender, l.principal, l.interest_rate, l.interest_type, l.tenure_months,
         to_char(l.start_date, 'YYYY-MM-DD') AS start_date, l.status,
         COALESCE((SELECT n.emi_amount FROM emi_schedule n
                    WHERE n.loan_id = l.id AND n.status <> 'paid' ORDER BY n.installment_no LIMIT 1),
                  MAX(e.emi_amount) FILTER (WHERE e.installment_no = 1))              AS emi_amount,
         COUNT(e.id)       FILTER (WHERE e.status = 'paid')                          AS paid_count,
         -- Outstanding = balance before the next unpaid EMI. Still correct after a prepayment (FR-11).
         COALESCE((SELECT n.closing_balance + n.principal_component FROM emi_schedule n
                    WHERE n.loan_id = l.id AND n.status <> 'paid' ORDER BY n.installment_no LIMIT 1), 0) AS outstanding,
         to_char(MIN(e.due_date) FILTER (WHERE e.status <> 'paid'), 'YYYY-MM-DD')    AS next_due_date
    FROM loans l
    LEFT JOIN emi_schedule e ON e.loan_id = l.id
   WHERE l.user_id = $1`;

function toLoan(r: Record<string, unknown>): LoanSummary {
  return {
    id: Number(r.id),
    loanType: String(r.loan_type),
    lender: String(r.lender),
    principal: Number(r.principal),
    interestRate: Number(r.interest_rate),
    interestType: String(r.interest_type),
    tenureMonths: Number(r.tenure_months),
    startDate: String(r.start_date),
    status: String(r.status),
    emiAmount: Number(r.emi_amount ?? 0),
    paidCount: Number(r.paid_count ?? 0),
    outstanding: Number(r.outstanding),
    nextDueDate: (r.next_due_date as string | null) ?? null,
  };
}

export async function listLoans(userId: number): Promise<LoanSummary[]> {
  const rows = await query(`${SUMMARY_SQL} GROUP BY l.id ORDER BY l.status, l.start_date DESC`, [userId]);
  return rows.map(toLoan);
}

export async function getLoan(userId: number, loanId: number): Promise<LoanSummary | null> {
  const rows = await query(`${SUMMARY_SQL} AND l.id = $2 GROUP BY l.id`, [userId, loanId]);
  return rows[0] ? toLoan(rows[0]) : null;
}

/** Inserts the full EMI schedule for a loan inside the caller's transaction. */
async function insertSchedule(client: PoolClient, loanId: number, input: LoanInput) {
  const schedule = generateSchedule(input.principal, input.interestRate, input.tenureMonths, input.startDate);
  await client.query(
    `INSERT INTO emi_schedule (loan_id, installment_no, due_date, emi_amount, principal_component, interest_component, closing_balance)
     SELECT $1, t.no, t.due::date, t.emi, t.principal, t.interest, t.balance
       FROM UNNEST($2::int[], $3::text[], $4::numeric[], $5::numeric[], $6::numeric[], $7::numeric[])
            AS t(no, due, emi, principal, interest, balance)`,
    [
      loanId,
      schedule.map((s) => s.installmentNo),
      schedule.map((s) => s.dueDate),
      schedule.map((s) => s.emiAmount),
      schedule.map((s) => s.principalComponent),
      schedule.map((s) => s.interestComponent),
      schedule.map((s) => s.closingBalance),
    ],
  );
}

/** The loan and every installment are written in ONE transaction – a loan never exists without its schedule (NFR-03). */
export async function createLoan(userId: number, input: LoanInput): Promise<LoanSummary> {
  const loanId = await withTransaction(async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO loans (user_id, loan_type, lender, principal, interest_rate, interest_type, tenure_months, start_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [userId, input.loanType, input.lender, input.principal, input.interestRate, input.interestType, input.tenureMonths, input.startDate],
    );
    const id = Number(rows[0].id);
    await insertSchedule(client, id, input);
    return id;
  });
  return (await getLoan(userId, loanId))!;
}

// ------------------------------------------------------------------ FR-08

export interface ScheduleRow {
  id: number;
  installmentNo: number;
  dueDate: string;
  emiAmount: number;
  principalComponent: number;
  interestComponent: number;
  closingBalance: number;
  status: string;
  paidDate: string | null;
}

export async function getSchedule(userId: number, loanId: number): Promise<ScheduleRow[]> {
  const rows = await query(
    `SELECT e.id, e.installment_no, to_char(e.due_date, 'YYYY-MM-DD') AS due_date, e.emi_amount,
            e.principal_component, e.interest_component, e.closing_balance, e.status,
            to_char(e.paid_date, 'YYYY-MM-DD') AS paid_date
       FROM emi_schedule e
       JOIN loans l ON l.id = e.loan_id
      WHERE e.loan_id = $1 AND l.user_id = $2
      ORDER BY e.installment_no`,
    [loanId, userId],
  );
  return rows.map((r) => ({
    id: Number(r.id),
    installmentNo: Number(r.installment_no),
    dueDate: String(r.due_date),
    emiAmount: Number(r.emi_amount),
    principalComponent: Number(r.principal_component),
    interestComponent: Number(r.interest_component),
    closingBalance: Number(r.closing_balance),
    status: String(r.status),
    paidDate: (r.paid_date as string | null) ?? null,
  }));
}

/** Edits loan terms and regenerates the schedule. Refused with 409 once any EMI is paid (keeps payment history). */
export async function updateLoan(userId: number, loanId: number, input: LoanInput): Promise<LoanSummary | null> {
  const found = await withTransaction(async (client) => {
    const own = await client.query('SELECT id FROM loans WHERE id = $1 AND user_id = $2 FOR UPDATE', [loanId, userId]);
    if (own.rows.length === 0) return false;
    const paid = await client.query("SELECT 1 FROM emi_schedule WHERE loan_id = $1 AND status = 'paid' LIMIT 1", [loanId]);
    if (paid.rows.length > 0) {
      throw new HttpError(409, 'This loan already has paid installments, so its terms cannot be changed.');
    }
    const prepaid = await client.query('SELECT 1 FROM loan_prepayments WHERE loan_id = $1 LIMIT 1', [loanId]);
    if (prepaid.rows.length > 0) {
      throw new HttpError(409, 'This loan has a prepayment, so its terms cannot be changed.');
    }
    await client.query(
      `UPDATE loans SET loan_type = $2, lender = $3, principal = $4, interest_rate = $5, interest_type = $6,
                        tenure_months = $7, start_date = $8
        WHERE id = $1`,
      [loanId, input.loanType, input.lender, input.principal, input.interestRate, input.interestType, input.tenureMonths, input.startDate],
    );
    await client.query('DELETE FROM emi_schedule WHERE loan_id = $1', [loanId]);
    await insertSchedule(client, loanId, input);
    return true;
  });
  return found ? getLoan(userId, loanId) : null;
}

export async function setLoanStatus(userId: number, loanId: number, status: 'active' | 'closed' | 'defaulted'): Promise<boolean> {
  const rows = await query('UPDATE loans SET status = $3 WHERE id = $1 AND user_id = $2 RETURNING id', [loanId, userId, status]);
  return rows.length > 0;
}

export async function deleteLoan(userId: number, loanId: number): Promise<boolean> {
  const rows = await query('DELETE FROM loans WHERE id = $1 AND user_id = $2 RETURNING id', [loanId, userId]);
  return rows.length > 0;
}

// ------------------------------------------------------------------ FR-09

/**
 * Marks one installment paid. In ONE transaction: installment -> paid, a ledger entry is written,
 * and the loan is closed if nothing is left unpaid (NFR-03). Returns null when the installment
 * does not exist, belongs to someone else, or is already paid.
 */
export async function payInstallment(userId: number, installmentId: number) {
  return withTransaction(async (client) => {
    const { rows } = await client.query<{ id: string; loan_id: string; emi_amount: string; installment_no: number; lender: string }>(
      `UPDATE emi_schedule e
          SET status = 'paid', paid_date = CURRENT_DATE
         FROM loans l
        WHERE e.id = $1 AND e.loan_id = l.id AND l.user_id = $2 AND e.status <> 'paid'
        RETURNING e.id, e.loan_id, e.emi_amount, e.installment_no, l.lender`,
      [installmentId, userId],
    );
    if (rows.length === 0) return null;
    const paid = rows[0];

    await client.query(
      `INSERT INTO transactions (user_id, txn_type, amount, txn_date, category, description, related_loan_id)
       VALUES ($1, 'loan', $2, CURRENT_DATE, 'EMI Payment', $3, $4)`,
      [userId, paid.emi_amount, `EMI #${paid.installment_no} – ${paid.lender}`, paid.loan_id],
    );

    const closed = await client.query(
      `UPDATE loans SET status = 'closed'
        WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM emi_schedule WHERE loan_id = $1 AND status <> 'paid')
        RETURNING id`,
      [paid.loan_id],
    );

    return {
      installmentId: Number(paid.id),
      loanId: Number(paid.loan_id),
      amount: Number(paid.emi_amount),
      loanClosed: closed.rows.length > 0,
    };
  });
}
