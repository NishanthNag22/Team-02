import { query } from './postgres';

export interface UserRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  role: 'individual' | 'advisor';
}

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const rows = await query<UserRow>(
    'SELECT id, name, email, password_hash, role FROM users WHERE email = $1',
    [email],
  );
  return rows[0] ?? null;
}

export async function createUser(u: {
  name: string; email: string; passwordHash: string; role: 'individual' | 'advisor'; panNumber?: string;
}): Promise<UserRow> {
  const rows = await query<UserRow>(
    `INSERT INTO users (name, email, password_hash, role, pan_number)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, email, password_hash, role`,
    [u.name, u.email, u.passwordHash, u.role, u.panNumber ?? null],
  );
  return { ...rows[0], id: Number(rows[0].id) };
}
