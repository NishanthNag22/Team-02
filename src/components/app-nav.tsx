'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

const LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/assets', label: 'Assets' },
  { href: '/loans', label: 'Loans' },
  { href: '/dues', label: 'Dues' },
  { href: '/transactions', label: 'Ledger' },
];

export function AppNav({ name, role }: { name: string; role: string }) {
  const router = useRouter();
  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }
  return (
    <nav className="border-b border-stone-300 bg-white">
      <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
        <Link href="/dashboard" className="font-bold text-amber-800">WealthWise</Link>
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="text-sm hover:underline">{l.label}</Link>
        ))}
        <span className="ml-auto text-sm opacity-70">{name} · {role}</span>
        <button onClick={logout} className="text-sm underline">Log out</button>
      </div>
    </nav>
  );
}
