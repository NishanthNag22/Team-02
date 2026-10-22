import { NextResponse } from 'next/server';
import { sessionCookie } from '@/lib/auth/jwt';

/** POST /api/auth/logout – FR-03 */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(sessionCookie('', 0));
  return res;
}
