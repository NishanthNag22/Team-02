import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { signupSchema } from '@/lib/validation/auth';
import { createUser, findUserByEmail } from '@/lib/db/users';
import { hashPassword } from '@/lib/auth/password';
import { sessionCookie, signSession } from '@/lib/auth/jwt';
import { apiError, HttpError } from '@/lib/api';

/** POST /api/auth/signup – FR-01 */
export async function POST(req: NextRequest) {
  try {
    const input = signupSchema.parse(await req.json());
    if (await findUserByEmail(input.email)) throw new HttpError(409, 'An account with that email already exists.');

    const user = await createUser({
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
      role: input.role,
      panNumber: input.panNumber,
    });
    const token = await signSession({ sub: String(user.id), email: user.email, name: user.name, role: user.role });

    const res = NextResponse.json(
      { user: { id: Number(user.id), name: user.name, email: user.email, role: user.role } },
      { status: 201 },
    );
    res.cookies.set(sessionCookie(token));
    return res;
  } catch (err) {
    return apiError(err);
  }
}
