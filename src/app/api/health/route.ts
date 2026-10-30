import { NextResponse } from 'next/server';
import { databaseTime } from '@/lib/db/health';

export const dynamic = 'force-dynamic';

/** GET /api/health – confirms the app can reach PostgreSQL. */
export async function GET() {
  try {
    return NextResponse.json({ status: 'ok', database: 'connected', time: await databaseTime() });
  } catch (err) {
    console.error('[health] database check failed:', err);
    return NextResponse.json({ status: 'error', database: 'unreachable' }, { status: 503 });
  }
}
