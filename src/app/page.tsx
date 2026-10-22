import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  if (await getCurrentUser()) redirect('/dashboard');
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-bold">WealthWise</h1>
      <p className="mt-2 text-lg">Net worth, loans and expenses in one place.</p>
      <div className="mt-6 flex gap-3">
        <Link href="/login" className="rounded bg-amber-700 px-4 py-2 text-white">Log in</Link>
        <Link href="/signup" className="rounded border border-amber-700 px-4 py-2">Sign up</Link>
      </div>
    </main>
  );
}
