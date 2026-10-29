import { query } from './postgres';
import { HttpError } from '@/lib/api';
import { listAssets } from './assets';
import { listLoans } from './loans';

// ---------------------------------------------------------------- individual side

export async function getMyAdvisor(userId: number) {
  const rows = await query(
    `SELECT a.id, a.name, a.email FROM users u JOIN users a ON a.id = u.advisor_id WHERE u.id = $1`,
    [userId],
  );
  return rows[0] ? { id: Number(rows[0].id), name: String(rows[0].name), email: String(rows[0].email) } : null;
}

/** An individual chooses their advisor by email. Only accounts with the advisor role can be chosen. */
export async function setMyAdvisor(userId: number, email: string) {
  const rows = await query("SELECT id FROM users WHERE email = $1 AND role = 'advisor'", [email.trim().toLowerCase()]);
  if (!rows[0]) throw new HttpError(404, 'No advisor account with that email.');
  if (Number(rows[0].id) === userId) throw new HttpError(422, 'You cannot be your own advisor.');
  await query('UPDATE users SET advisor_id = $2 WHERE id = $1', [userId, rows[0].id]);
  return getMyAdvisor(userId);
}

export async function clearMyAdvisor(userId: number) {
  await query('UPDATE users SET advisor_id = NULL WHERE id = $1', [userId]);
}

// ---------------------------------------------------------------- advisor side

/** Assigned clients only, each with a live net worth summary (FR-26). */
export async function listClients(advisorId: number) {
  const rows = await query(
    `SELECT u.id, u.name, u.email,
            (SELECT COALESCE(SUM(current_value), 0) FROM assets WHERE user_id = u.id) AS assets,
            (SELECT COALESCE(SUM((SELECT e.closing_balance + e.principal_component FROM emi_schedule e
                                   WHERE e.loan_id = l.id AND e.status <> 'paid' ORDER BY e.installment_no LIMIT 1)), 0)
               FROM loans l WHERE l.user_id = u.id AND l.status = 'active') AS liabilities,
            (SELECT count(*) FROM loans WHERE user_id = u.id AND status = 'active') AS active_loans,
            (SELECT count(*) FROM emi_schedule e JOIN loans l ON l.id = e.loan_id
              WHERE l.user_id = u.id AND l.status = 'active' AND e.status <> 'paid' AND e.due_date < CURRENT_DATE) AS overdue
       FROM users u WHERE u.advisor_id = $1 ORDER BY u.name`,
    [advisorId],
  );
  return rows.map((r) => ({
    id: Number(r.id), name: String(r.name), email: String(r.email),
    totalAssets: Number(r.assets), totalLiabilities: Number(r.liabilities),
    netWorth: Math.round((Number(r.assets) - Number(r.liabilities)) * 100) / 100,
    activeLoans: Number(r.active_loans), overdueEmis: Number(r.overdue),
  }));
}

export async function advisorOwnsClient(advisorId: number, clientId: number): Promise<boolean> {
  const rows = await query('SELECT 1 FROM users WHERE id = $1 AND advisor_id = $2', [clientId, advisorId]);
  return rows.length > 0;
}

/** Read-only view of one client. Any user not assigned to this advisor is refused with 403 (SR-05). */
export async function clientDetail(advisorId: number, clientId: number) {
  if (!(await advisorOwnsClient(advisorId, clientId))) throw new HttpError(403, 'This user is not your client.');
  const [summary] = (await listClients(advisorId)).filter((c) => c.id === clientId);
  const [assets, loans] = await Promise.all([listAssets(clientId), listLoans(clientId)]);
  return { client: summary, assets, loans };
}
