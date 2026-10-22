import bcrypt from 'bcryptjs';

const ROUNDS = 12; // SR-01: bcrypt cost 12

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

let dummy: Promise<string> | null = null;
/** A real hash to compare against when the email does not exist, so both paths take similar time (SR-03). */
export function dummyHash(): Promise<string> {
  if (!dummy) dummy = bcrypt.hash('not-a-real-password', ROUNDS);
  return dummy;
}
