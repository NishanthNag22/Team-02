'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setFields({});
    const body = Object.fromEntries(new FormData(e.currentTarget));
    const res = await fetch(`/api/auth/${mode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? 'Something went wrong');
      setFields(data.fields ?? {});
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  const input = 'mt-1 w-full rounded border border-stone-300 bg-white px-3 py-2';
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold">{mode === 'login' ? 'Log in to WealthWise' : 'Create your account'}</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        {mode === 'signup' && (
          <label className="block text-sm">Name
            <input name="name" required className={input} />
            {fields.name && <span className="text-xs text-red-700">{fields.name[0]}</span>}
          </label>
        )}
        <label className="block text-sm">Email
          <input name="email" type="email" required className={input} />
          {fields.email && <span className="text-xs text-red-700">{fields.email[0]}</span>}
        </label>
        <label className="block text-sm">Password
          <input name="password" type="password" required className={input} />
          {fields.password && <span className="text-xs text-red-700">{fields.password[0]}</span>}
        </label>
        {mode === 'signup' && (
          <>
            <label className="block text-sm">Role
              <select name="role" className={input} defaultValue="individual">
                <option value="individual">Individual</option>
                <option value="advisor">Advisor</option>
              </select>
            </label>
            <label className="block text-sm">PAN (optional)
              <input name="panNumber" placeholder="ABCDE1234F" className={input} />
              {fields.panNumber && <span className="text-xs text-red-700">{fields.panNumber[0]}</span>}
            </label>
          </>
        )}
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button disabled={busy} className="w-full rounded bg-amber-700 px-4 py-2 font-medium text-white disabled:opacity-50">
          {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Sign up'}
        </button>
      </form>
      <p className="mt-4 text-sm">
        {mode === 'login'
          ? <>No account? <Link className="underline" href="/signup">Sign up</Link></>
          : <>Already registered? <Link className="underline" href="/login">Log in</Link></>}
      </p>
    </main>
  );
}
