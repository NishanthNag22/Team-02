import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { getDashboard } from '../../src/lib/db/dashboard';
import { listTransactions } from '../../src/lib/db/transactions';
import { query } from '../../src/lib/db/postgres';
import { cleanup, createTestUser } from './helpers';

/**
 * NFR-01: the dashboard must answer within 2 s for 90 % of requests.
 * Loads a realistic account (3 years of ledger, 5 loans) and measures 20 calls.
 */
const users: number[] = [];
after(() => cleanup(users));

function p90(ms: number[]): number {
  const s = [...ms].sort((a, b) => a - b);
  return s[Math.ceil(s.length * 0.9) - 1];
}

test('dashboard and ledger search p90 under 2 seconds with 3,000 transactions (NFR-01)', async () => {
  const u = await createTestUser();
  users.push(u);
  await query(
    `INSERT INTO transactions (user_id, txn_type, amount, txn_date, category, description)
     SELECT $1, CASE WHEN g % 10 = 0 THEN 'income'::txn_type ELSE 'expense'::txn_type END,
            100 + (g % 900), CURRENT_DATE - (g % 1095), (ARRAY['Food','Fuel','Groceries','Rent','Salary'])[1 + g % 5],
            'UPI PAYMENT MERCHANT ' || g
       FROM generate_series(1, 3000) g`,
    [u],
  );
  for (let i = 0; i < 5; i++) {
    const loan = await query(
      `INSERT INTO loans (user_id, loan_type, lender, principal, interest_rate, tenure_months, start_date)
       VALUES ($1, 'personal', 'Bank ' || $2::text, 500000, 11, 240, CURRENT_DATE - 400) RETURNING id`,
      [u, i],
    );
    await query(
      `INSERT INTO emi_schedule (loan_id, installment_no, due_date, emi_amount, principal_component, interest_component, closing_balance)
       SELECT $1, n, CURRENT_DATE - 400 + n * 30, 5160, 1000, 4160, 500000 - n * 1000 FROM generate_series(1, 240) n`,
      [loan[0].id],
    );
  }

  const dash: number[] = [];
  const search: number[] = [];
  for (let i = 0; i < 20; i++) {
    let t = performance.now();
    await getDashboard(u);
    dash.push(performance.now() - t);
    t = performance.now();
    await listTransactions(u, { limit: 100, search: 'merchant' });
    search.push(performance.now() - t);
  }
  console.log(`dashboard p90 ${p90(dash).toFixed(0)} ms, search p90 ${p90(search).toFixed(0)} ms`);
  assert.ok(p90(dash) < 2000, `dashboard p90 ${p90(dash)} ms`);
  assert.ok(p90(search) < 2000, `search p90 ${p90(search)} ms`);
});
