import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE = 'ww_session';

export interface SessionClaims {
  sub: string;
  email: string;
  name: string;
  role: 'individual' | 'advisor';
}

function key(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new Error('JWT_SECRET must be set and at least 32 characters long.');
  return new TextEncoder().encode(secret);
}

/** SR-02: HS256-signed token with issuer and expiry. */
export async function signSession(c: SessionClaims): Promise<string> {
  return new SignJWT({ email: c.email, name: c.name, role: c.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(c.sub)
    .setIssuer('wealthwise')
    .setIssuedAt()
    .setExpirationTime(process.env.JWT_EXPIRES_IN ?? '7d')
    .sign(key());
}

/** Returns the claims, or null for a missing, expired, tampered or wrongly signed token. */
export async function verifySession(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, key(), { issuer: 'wealthwise', algorithms: ['HS256'] });
    if (!payload.sub) return null;
    return {
      sub: payload.sub,
      email: String(payload.email ?? ''),
      name: String(payload.name ?? ''),
      role: payload.role === 'advisor' ? 'advisor' : 'individual',
    };
  } catch {
    return null;
  }
}

export function sessionCookie(value: string, maxAgeSeconds = 60 * 60 * 24 * 7) {
  return {
    name: SESSION_COOKIE,
    value,
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: maxAgeSeconds,
  };
}
