import { query, withTransaction } from './postgres';
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
         MAX(e.emi_amount) FILTER (WHERE e.installment_no = 1)                       AS emi_amount,
         COUNT(e.id)       FILTER (WHERE e.status = 'paid')                          AS paid_count,
         COALESCE(MIN(e.closing_balance) FILTER (WHERE e.status = 'paid'), l.principal) AS outstanding,
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

/** The loan and every installment are written in ONE transaction – a loan never exists without its schedule (NFR-03). */
export async function createLoan(userId: number, input: LoanInput): Promise<LoanSummary> {
  const loanId = await withTransaction(async (client) => {
    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO loans (user_id, loan_type, lender, principal, interest_rate, interest_type, tenure_months, start_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [userId, input.loanType, input.lender, input.principal, input.interestRate, input.interestType, input.tenureMonths, input.startDate],
    );
    const id = Number(rows[0].id);
    const schedule = generateSchedule(input.principal, input.interestRate, input.tenureMonths, input.startDate);
    await client.query(
      `INSERT INTO emi_schedule (loan_id, installment_no, due_date, emi_amount, principal_component, interest_component, closing_balance)
       SELECT $1, t.no, t.due::date, t.emi, t.principal, t.interest, t.balance
         FROM UNNEST($2::int[], $3::text[], $4::numeric[], $5::numeric[], $6::numeric[], $7::numeric[])
              AS t(no, due, emi, principal, interest, balance)`,
      [
        id,
        schedule.map((s) => s.installmentNo),
        schedule.map((s) => s.dueDate),
        schedule.map((s) => s.emiAmount),
        schedule.map((s) => s.principalComponent),
        schedule.map((s) => s.interestComponent),
        schedule.map((s) => s.closingBalance),
      ],
    );
    return id;
  });
  return (await getLoan(userId, loanId))!;
}
