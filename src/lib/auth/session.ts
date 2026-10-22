import { cookies } from 'next/headers';
import { HttpError } from '@/lib/api';
import { SESSION_COOKIE, verifySession } from './jwt';

export interface CurrentUser {
  id: number;
  email: string;
  name: string;
  role: 'individual' | 'advisor';
}

/** The signed-in user, or null. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const c = await verifySession(token);
  return c ? { id: Number(c.sub), email: c.email, name: c.name, role: c.role } : null;
}

/** Use at the start of every protected API: throws 401 when signed out (FR-04, SR-04). */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new HttpError(401, 'Authentication required.');
  return user;
}

/** Advisor-only APIs: throws 403 for individuals. */
export async function requireAdvisor(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== 'advisor') throw new HttpError(403, 'Advisor role required.');
  return user;
}
