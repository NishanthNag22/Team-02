import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../../src/lib/db/postgres';
import { cleanup, createTestUser } from './helpers';

const users: number[] = [];
after(() => cleanup(users));

test('all core tables exist after migrations', async () => {
  const rows = await query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
  );
  const names = rows.map((r) => r.table_name);
  for (const t of ['users', 'loans', 'emi_schedule', 'transactions']) {
    assert.ok(names.includes(t), `missing table ${t}`);
  }
});

test('emails are unique and stored in lower case', async () => {
  users.push(await createTestUser());
  await assert.rejects(
    query(`INSERT INTO users (name, email, password_hash) VALUES ('X Y', 'UPPER@Example.com', 'x')`),
    /users_email_check/,
  );
});

test('money cannot be negative (CHECK constraint)', async () => {
  const id = await createTestUser();
  users.push(id);
  await assert.rejects(
    query(`INSERT INTO transactions (user_id, txn_type, amount, txn_date) VALUES ($1, 'expense', -5, CURRENT_DATE)`, [id]),
    /transactions_amount_check/,
  );
});
