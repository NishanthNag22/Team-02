import { query } from './postgres';

export type Urgency = 'overdue' | 'due_this_week' | 'due_this_month' | 'upcoming';

export interface Due {
  installmentId: number;
  loanId: number;
  lender: string;
  loanType: string;
  installmentNo: number;
  dueDate: string;
  emiAmount: number;
  status: string;
  daysUntilDue: number;
  urgency: Urgency;
}

/** Flips this user's unpaid, past-due installments to 'overdue'. Returns how many changed (FR-10). */
export async function markOverdue(userId: number): Promise<number> {
  const rows = await query(
    `UPDATE emi_schedule e SET status = 'overdue'
       FROM loans l
      WHERE e.loan_id = l.id AND l.user_id = $1 AND l.status = 'active'
        AND e.status = 'pending' AND e.due_date < CURRENT_DATE
      RETURNING e.id`,
    [userId],
  );
  return rows.length;
}

/** Unpaid installments of active loans that are overdue or due within `days`, grouped by urgency (FR-10). */
export async function upcomingDues(userId: number, days = 45, limit = 100): Promise<Due[]> {
  const rows = await query(
    `SELECT e.id AS installment_id, l.id AS loan_id, l.lender, l.loan_type, e.installment_no,
            to_char(e.due_date, 'YYYY-MM-DD') AS due_date, e.emi_amount, e.status,
            (e.due_date - CURRENT_DATE) AS days_until_due,
            CASE
              WHEN e.due_date <  CURRENT_DATE      THEN 'overdue'
              WHEN e.due_date <= CURRENT_DATE + 7  THEN 'due_this_week'
              WHEN e.due_date <= CURRENT_DATE + 30 THEN 'due_this_month'
              ELSE 'upcoming'
            END AS urgency
       FROM emi_schedule e
       JOIN loans l ON l.id = e.loan_id
      WHERE l.user_id = $1 AND l.status = 'active' AND e.status <> 'paid'
        AND e.due_date <= CURRENT_DATE + $2::int
      ORDER BY e.due_date, l.id
      LIMIT $3`,
    [userId, days, limit],
  );
  return rows.map((r) => ({
    installmentId: Number(r.installment_id),
    loanId: Number(r.loan_id),
    lender: String(r.lender),
    loanType: String(r.loan_type),
    installmentNo: Number(r.installment_no),
    dueDate: String(r.due_date),
    emiAmount: Number(r.emi_amount),
    status: String(r.status),
    daysUntilDue: Number(r.days_until_due),
    urgency: r.urgency as Urgency,
  }));
}