import { query } from './postgres';

/** Current database time – used by GET /api/health to prove PostgreSQL is reachable. */
export async function databaseTime(): Promise<string | undefined> {
  const rows = await query<{ now: string }>('SELECT now()::text AS now');
  return rows[0]?.now;
}
