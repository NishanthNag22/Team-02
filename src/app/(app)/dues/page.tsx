'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatINR } from '@/lib/format';

interface Due {
  installmentId: number; loanId: number; lender: string; installmentNo: number; dueDate: string;
  emiAmount: number; daysUntilDue: number; urgency: 'overdue' | 'due_this_week' | 'due_this_month' | 'upcoming';
}

const GROUPS = [
  { key: 'overdue', title: 'Overdue', color: 'border-red-700 text-red-800' },
  { key: 'due_this_week', title: 'Due this week', color: 'border-amber-600 text-amber-800' },
  { key: 'due_this_month', title: 'Due this month', color: 'border-sky-700 text-sky-800' },
  { key: 'upcoming', title: 'Upcoming', color: 'border-stone-400 text-stone-700' },
] as const;

export default function DuesPage() {
  const [dues, setDues] = useState<Due[] | null>(null);
  const [days, setDays] = useState(45);

  useEffect(() => {
    fetch(`/api/dues?days=${days}`).then(async (r) => r.ok && setDues((await r.json()).dues));
  }, [days]);

  if (!dues) return <p>Loading…</p>;
  const total = dues.reduce((s, d) => s + d.emiAmount, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold">Upcoming &amp; overdue EMIs</h1>
      <div className="mt-2 flex items-center gap-3 text-sm">
        <span>Next</span>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="rounded border border-stone-300 bg-white px-2 py-1">
          {[7, 30, 45, 90, 365].map((d) => <option key={d} value={d}>{d} days</option>)}
        </select>
        <span className="opacity-70">· {dues.length} installments · {formatINR(total)}</span>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {GROUPS.map((g) => {
          const items = dues.filter((d) => d.urgency === g.key);
          return (
            <div key={g.key} className={`rounded border-l-4 bg-white p-4 ${g.color}`}>
              <h2 className="font-semibold">{g.title} ({items.length})</h2>
              {items.length === 0 && <p className="mt-2 text-sm opacity-60">Nothing here.</p>}
              <ul className="mt-2 space-y-1 text-sm text-stone-800">
                {items.map((d) => (
                  <li key={d.installmentId} className="flex justify-between">
                    <Link href={`/loans/${d.loanId}`} className="underline">{d.lender} · EMI #{d.installmentNo}</Link>
                    <span className="tabular-nums">
                      {d.dueDate} ({d.daysUntilDue < 0 ? `${-d.daysUntilDue} days late` : `in ${d.daysUntilDue} days`}) · {formatINR(d.emiAmount)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}