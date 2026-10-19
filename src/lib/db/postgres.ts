import { Pool, type PoolClient, type QueryResultRow } from 'pg';

/**
 * Shared PostgreSQL connection pool (SAD CMP-16, data-access layer).
 * The connection string comes only from the environment (SRS NFR-07, SR-09).
 */
let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.');
    pool = new Pool({ connectionString, max: 10 });
  }
  return pool;
}

/** Runs a parameterised query and returns the rows. Never build SQL by string concatenation. */
export async function query<T extends QueryResultRow>(sql: string, params: unknown[] = []): Promise<T[]> {
  const result = await getPool().query<T>(sql, params);
  return result.rows;
}

/** Runs several statements atomically: COMMIT on success, ROLLBACK on any error (SRS NFR-03). */
export async function withTransaction<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
