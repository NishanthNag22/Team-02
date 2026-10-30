import { query } from './postgres';
import { HttpError } from '@/lib/api';

export interface Rule {
  id: number;
  keyword: string;
  category: string;
  txnType: string;
  priority: number;
  isSystem: boolean;
}

const toRule = (r: Record<string, unknown>): Rule => ({
  id: Number(r.id),
  keyword: String(r.keyword),
  category: String(r.category),
  txnType: String(r.txn_type),
  priority: Number(r.priority),
  isSystem: r.user_id == null,
});

/** My rules first, then the shared system rules. */
export async function listRules(userId: number): Promise<Rule[]> {
  const rows = await query(
    `SELECT id, user_id, keyword, category, txn_type, priority FROM categorization_rules
      WHERE user_id = $1 OR user_id IS NULL
      ORDER BY (user_id IS NULL), priority, keyword`,
    [userId],
  );
  return rows.map(toRule);
}

/**
 * Picks the category for a bank narration (FR-15). Precedence: the user's own rule beats any system rule,
 * then lower priority number, then the longest keyword ("BIG BAZAAR" beats "BIG").
 */
export async function categorize(userId: number, description: string): Promise<{ category: string; txnType: string | null; keyword: string | null }> {
  const rows = await query(
    `SELECT keyword, category, txn_type FROM categorization_rules
      WHERE (user_id = $1 OR user_id IS NULL)
        AND position(upper(keyword) IN upper($2)) > 0
      ORDER BY (user_id IS NULL), priority, length(keyword) DESC
      LIMIT 1`,
    [userId, description],
  );
  if (!rows[0]) return { category: 'Uncategorized', txnType: null, keyword: null };
  return { category: String(rows[0].category), txnType: String(rows[0].txn_type), keyword: String(rows[0].keyword) };
}

export async function createRule(
  userId: number,
  r: { keyword: string; category: string; txnType: string; priority?: number },
): Promise<Rule> {
  const rows = await query(
    `INSERT INTO categorization_rules (user_id, keyword, category, txn_type, priority)
     VALUES ($1, upper(trim($2)), $3, $4, $5)
     RETURNING id, user_id, keyword, category, txn_type, priority`,
    [userId, r.keyword, r.category, r.txnType, r.priority ?? 5],
  );
  return toRule(rows[0]);
}

/** Only the user's own rules can be deleted; system rules are shared. */
export async function deleteRule(userId: number, id: number): Promise<void> {
  const rows = await query('DELETE FROM categorization_rules WHERE id = $1 AND user_id = $2 RETURNING id', [id, userId]);
  if (rows.length === 0) throw new HttpError(404, 'Rule not found, or it is a system rule.');
}

/** Applies a new rule to the user's existing transactions whose description contains the keyword. */
export async function applyRuleToExisting(userId: number, rule: Rule): Promise<number> {
  const rows = await query(
    `UPDATE transactions SET category = $3
      WHERE user_id = $1 AND position(upper($2) IN upper(coalesce(description, ''))) > 0 AND category <> $3
      RETURNING id`,
    [userId, rule.keyword, rule.category],
  );
  return rows.length;
}
