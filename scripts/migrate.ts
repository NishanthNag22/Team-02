/**
 * Applies db/migrations/*.sql in filename order. Each file runs in its own transaction
 * and is recorded in schema_migrations, so it is applied only once.
 * Usage: npm run db:migrate
 */
import 'dotenv/config';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set (see .env.example).');

  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    const done = new Set(
      (await client.query<{ filename: string }>('SELECT filename FROM schema_migrations')).rows.map((r) => r.filename),
    );

    const dir = join(process.cwd(), 'db', 'migrations');
    const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

    for (const file of files) {
      if (done.has(file)) continue;
      const sql = readFileSync(join(dir, file), 'utf8');
      try {
        await client.query('BEGIN');
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`applied  ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`FAILED   ${file}`);
        throw err;
      }
    }
    console.log('migrations up to date');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
