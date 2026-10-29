'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { NotificationBell } from './notification-bell';

const LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/assets', label: 'Assets' },
  { href: '/loans', label: 'Loans' },
  { href: '/dues', label: 'Dues' },
  { href: '/transactions', label: 'Ledger' },
  { href: '/import', label: 'Import' },
  { href: '/receipts', label: 'Receipts' },
  { href: '/vault', label: 'Vault' },
  { href: '/insights', label: 'Insights' },
  { href: '/projection', label: 'Projection' },
  { href: '/reports', label: 'Reports' },
  { href: '/news', label: 'News' },
  { href: '/advisor', label: 'Advisor' },
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
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
        <Link href="/dashboard" className="font-bold text-amber-800">WealthWise</Link>
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="text-sm hover:underline">{l.label}</Link>
        ))}
        <span className="ml-auto"><NotificationBell /></span>
        <span className="text-sm opacity-70">{name} · {role}</span>
        <button onClick={logout} className="text-sm underline">Log out</button>
      </div>
    </nav>
  );
}
