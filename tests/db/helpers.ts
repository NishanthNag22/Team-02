import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { getPool, query } from '../../src/lib/db/postgres';

/** Creates a throw-away user for one test file; each file uses its own users so tests never share data. */
export async function createTestUser(role: 'individual' | 'advisor' = 'individual'): Promise<number> {
  const email = `test-${randomUUID()}@example.com`;
  const rows = await query<{ id: string }>(
    `INSERT INTO users (name, email, password_hash, role) VALUES ('Test User', $1, 'not-a-real-hash', $2) RETURNING id`,
    [email, role],
  );
  return Number(rows[0].id);
}

/** Deletes the test users (their assets, loans, transactions … cascade) and closes the pool. */
export async function cleanup(userIds: number[]): Promise<void> {
  if (userIds.length) await query('DELETE FROM users WHERE id = ANY($1::bigint[])', [userIds]);
  await getPool().end();
}
