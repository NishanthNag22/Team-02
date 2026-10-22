import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { loginSchema } from '@/lib/validation/auth';
import { findUserByEmail } from '@/lib/db/users';
import { dummyHash, verifyPassword } from '@/lib/auth/password';
import { sessionCookie, signSession } from '@/lib/auth/jwt';
import { apiError, HttpError } from '@/lib/api';

/** POST /api/auth/login – FR-02. Same message for unknown email and wrong password (SR-03). */
export async function POST(req: NextRequest) {
  try {
    const input = loginSchema.parse(await req.json());
    const user = await findUserByEmail(input.email);

    if (!user) {
      await verifyPassword(input.password, await dummyHash());
      throw new HttpError(401, 'Invalid email or password.');
    }
    if (!(await verifyPassword(input.password, user.password_hash))) {
      throw new HttpError(401, 'Invalid email or password.');
    }

    const token = await signSession({ sub: String(user.id), email: user.email, name: user.name, role: user.role });
    const res = NextResponse.json({ user: { id: Number(user.id), name: user.name, email: user.email, role: user.role } });
    res.cookies.set(sessionCookie(token));
    return res;
  } catch (err) {
    return apiError(err);
  }
}
