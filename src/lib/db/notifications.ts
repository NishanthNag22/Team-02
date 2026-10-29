import { query } from './postgres';
import { markOverdue } from './dues';

/**
 * Creates any missing reminders (FR-24): "due soon" for unpaid installments due in the next 7 days,
 * "overdue" for past-due ones. The UNIQUE (installment_id, kind) index makes this safe to run on every read.
 */
export async function generateNotifications(userId: number): Promise<number> {
  await markOverdue(userId);
  const rows = await query(
    `INSERT INTO notifications (user_id, installment_id, kind, title, body)
     SELECT l.user_id, e.id,
            CASE WHEN e.due_date < CURRENT_DATE THEN 'overdue'::notification_kind ELSE 'due_soon'::notification_kind END,
            CASE WHEN e.due_date < CURRENT_DATE THEN 'EMI overdue – ' || l.lender ELSE 'EMI due soon – ' || l.lender END,
            'EMI #' || e.installment_no || ' of Rs. ' || to_char(e.emi_amount, 'FM99,99,99,99,990.00') ||
            CASE WHEN e.due_date < CURRENT_DATE THEN ' was due on ' ELSE ' is due on ' END || to_char(e.due_date, 'DD Mon YYYY')
       FROM emi_schedule e JOIN loans l ON l.id = e.loan_id
      WHERE l.user_id = $1 AND l.status = 'active' AND e.status <> 'paid'
        AND e.due_date <= CURRENT_DATE + 7
     ON CONFLICT (installment_id, kind) DO NOTHING
     RETURNING id`,
    [userId],
  );
  return rows.length;
}

export async function listNotifications(userId: number) {
  await generateNotifications(userId);
  const rows = await query(
    `SELECT n.id, n.kind, n.title, n.body, n.is_read, n.created_at, e.loan_id
       FROM notifications n JOIN emi_schedule e ON e.id = n.installment_id
      WHERE n.user_id = $1 ORDER BY n.is_read, n.created_at DESC, n.id DESC LIMIT 50`,
    [userId],
  );
  const unread = await query('SELECT count(*)::int AS n FROM notifications WHERE user_id = $1 AND NOT is_read', [userId]);
  return {
    unread: Number(unread[0].n),
    notifications: rows.map((r) => ({
      id: Number(r.id), kind: String(r.kind), title: String(r.title), body: String(r.body), isRead: Boolean(r.is_read),
      loanId: Number(r.loan_id), createdAt: new Date(r.created_at as string).toISOString(),
    })),
  };
}

/** Marks one of MY notifications read (another user's id changes nothing). Returns rows changed. */
export async function markRead(userId: number, id: number): Promise<number> {
  const rows = await query('UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2 AND NOT is_read RETURNING id', [id, userId]);
  return rows.length;
}

export async function markAllRead(userId: number): Promise<number> {
  const rows = await query('UPDATE notifications SET is_read = true WHERE user_id = $1 AND NOT is_read RETURNING id', [userId]);
  return rows.length;
}
