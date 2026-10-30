import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword } from '../../src/lib/auth/password';
import { signSession, verifySession } from '../../src/lib/auth/jwt';
import { apiError, HttpError, parseId } from '../../src/lib/api';
import { maskPan } from '../../src/lib/services/pdf-statement';

/** SEC-01: security checks that run on every push (SR-01, SR-02, SR-06, SR-08, SR-09; SR-07 upload checks are in tests/unit/file-store.test.ts). */
process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';
const claims = { sub: '42', email: 'a@b.co', name: 'A', role: 'individual' as const };

test('SR-01: passwords are bcrypt-hashed with cost 12, never stored as plain text', async () => {
  const h = await hashPassword('correct horse battery');
  assert.match(h, /^\$2[aby]\$12\$/);
  assert.ok(!h.includes('correct horse'));
  assert.equal(await verifyPassword('correct horse battery', h), true);
  assert.equal(await verifyPassword('wrong', h), false);
});

test('SR-02: a tampered or wrongly signed session token is rejected', async () => {
  const token = await signSession(claims);
  assert.equal((await verifySession(token))?.sub, '42');

  const [h, p, s] = token.split('.');
  const forged = JSON.parse(Buffer.from(p, 'base64url').toString());
  forged.role = 'advisor';
  assert.equal(await verifySession(`${h}.${Buffer.from(JSON.stringify(forged)).toString('base64url')}.${s}`), null);

  const unsigned = `${Buffer.from('{"alg":"none"}').toString('base64url')}.${p}.`;
  assert.equal(await verifySession(unsigned), null);

  process.env.JWT_SECRET = 'a-completely-different-secret-of-32-chars!!';
  assert.equal(await verifySession(token), null);
  process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';
});

test('SR-02: a short JWT secret is refused', async () => {
  const saved = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'short';
  await assert.rejects(signSession(claims), /at least 32 characters/);
  process.env.JWT_SECRET = saved;
});

test('SR-06: ids from the URL must be positive integers', () => {
  for (const bad of ['1 OR 1=1', '-1', '0', '1.5', 'abc', "1'; DROP TABLE users;--"]) {
    assert.throws(() => parseId(bad), { status: 404 }, bad);
  }
  assert.equal(parseId('17'), 17);
});

test('SR-08: unexpected errors return a generic 500 without internal details', async () => {
  const origError = console.error;
  console.error = () => undefined;
  const res = apiError(new Error('relation "users" does not exist at /home/app/src/x.ts:12'));
  console.error = origError;
  assert.equal(res.status, 500);
  const body = await res.json();
  assert.deepEqual(body, { error: 'Internal server error' });
  assert.equal(apiError(new HttpError(403, 'Advisor role required.')).status, 403);
});

test('SR-08: database constraint errors map to safe messages', async () => {
  const res = apiError(Object.assign(new Error('duplicate key value violates unique constraint "users_email_key"'), { code: '23505' }));
  assert.equal(res.status, 409);
  assert.ok(!JSON.stringify(await res.json()).includes('users_email_key'));
});

test('SR-09: PAN is masked on statements', () => {
  assert.equal(maskPan('ABCDE1234F'), 'XXXXXX234F');
});
