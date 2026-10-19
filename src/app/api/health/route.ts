import { NextResponse } from 'next/server';
import { query } from '@/lib/db/postgres';

export const dynamic = 'force-dynamic';

/** GET /api/health – confirms the app can reach PostgreSQL. */
export async function GET() {
  try {
    const rows = await query<{ now: string }>('SELECT now()::text AS now');
    return NextResponse.json({ status: 'ok', database: 'connected', time: rows[0]?.now });
  } catch (err) {
    console.error('[health] database check failed:', err);
    return NextResponse.json({ status: 'error', database: 'unreachable' }, { status: 503 });
  }
}
