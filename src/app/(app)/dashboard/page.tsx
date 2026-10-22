'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { formatINR } from '@/lib/format';

interface Dashboard {
  summary: { totalAssets: number; totalLiabilities: number; netWorth: number; liquidAssets: number };
  trend: { date: string; netWorth: number; change: number | null }[];
  allocation: { assetType: string; value: number; pct: number }[];
  loans: { id: number; lender: string; principal: number; outstanding: number; paidCount: number; tenureMonths: number; status: string }[];
  dues: { installmentId: number; loanId: number; lender: string; installmentNo: number; dueDate: string; emiAmount: number; urgency: string }[];
  cashflow: { month: string; income: number; expense: number }[];
  recurring: { category: string; months: number; avgAmount: number }[];
}

// Colour is never the only signal: every bar also has a text label (NFR-05).
const COLORS = ['#3f6a92', '#5f8449', '#b0663a', '#59447a', '#2c635f', '#9c7620', '#8e3c3c'];
const SPECIAL: Record<string, string> = { fd: 'FD', epf: 'EPF', ppf: 'PPF' };
const label = (t: string) => SPECIAL[t] ?? t.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const compact = (v: number) => (Math.abs(v) >= 1e7 ? `₹${(v / 1e7).toFixed(2)} Cr` : Math.abs(v) >= 1e5 ? `₹${(v / 1e5).toFixed(2)} L` : formatINR(v, 0));

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded border border-stone-300 bg-white p-4"><h2 className="mb-3 font-semibold">{title}</h2>{children}</section>;
}

export default function DashboardPage() {
  const [d, setD] = useState<Dashboard | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/dashboard').then(async (r) => (r.ok ? setD(await r.json()) : setError(true)));
  }, []);

  if (error) return <p>Could not load the dashboard.</p>;
  if (!d) return <p>Loading…</p>;

  const s = d.summary;
  const maxFlow = Math.max(1, ...d.cashflow.flatMap((c) => [c.income, c.expense]));
  const last = d.trend[d.trend.length - 1];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ['Net worth', s.netWorth, last?.change != null ? `${last.change >= 0 ? '▲' : '▼'} ${formatINR(Math.abs(last.change))} since last snapshot` : 'First snapshot today'],
          ['Total assets', s.totalAssets, `${compact(s.liquidAssets)} liquid`],
          ['Total liabilities', s.totalLiabilities, `${d.loans.filter((l) => l.status === 'active').length} active loans`],
          ['Upcoming EMIs (45 days)', d.dues.reduce((t, x) => t + x.emiAmount, 0), `${d.dues.filter((x) => x.urgency === 'overdue').length} overdue`],
        ].map(([t, v, sub]) => (
          <div key={t as string} className="rounded border border-stone-300 bg-white p-4">
            <div className="text-xs uppercase opacity-60">{t}</div>
            <div className={`mt-1 text-xl font-semibold tabular-nums ${t === 'Net worth' && (v as number) < 0 ? 'text-red-700' : ''}`}>{formatINR(v as number)}</div>
            <div className="mt-1 text-xs opacity-60">{sub}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Asset allocation">
          {d.allocation.length === 0 ? <p className="text-sm opacity-60">No assets yet. <Link className="underline" href="/assets">Add one</Link></p> : (
            <>
              <div className="flex h-6 overflow-hidden rounded">
                {d.allocation.map((a, i) => <div key={a.assetType} title={`${label(a.assetType)} ${a.pct}%`} style={{ width: `${a.pct}%`, background: COLORS[i % COLORS.length] }} />)}
              </div>
              <ul className="mt-3 space-y-1 text-sm">
                {d.allocation.map((a, i) => (
                  <li key={a.assetType} className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-sm" style={{ background: COLORS[i % COLORS.length] }} />
                    {label(a.assetType)}<span className="ml-auto tabular-nums">{formatINR(a.value)} · {a.pct}%</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <Card title="Loan payoff progress">
          {d.loans.length === 0 ? <p className="text-sm opacity-60">No loans yet.</p> : (
            <ul className="space-y-3 text-sm">
              {d.loans.map((l) => {
                const pct = Math.round(((l.principal - l.outstanding) / l.principal) * 1000) / 10;
                return (
                  <li key={l.id}>
                    <div className="flex"><Link href={`/loans/${l.id}`} className="underline">{l.lender}</Link>
                      <span className="ml-auto tabular-nums">{formatINR(l.outstanding)} left · {pct}% repaid · {l.paidCount}/{l.tenureMonths} EMIs</span></div>
                    <div className="mt-1 h-2 rounded bg-stone-200"><div className="h-2 rounded bg-green-700" style={{ width: `${pct}%` }} /></div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card title="Income vs expense – last 12 months">
          <div className="flex h-40 items-end gap-1">
            {d.cashflow.map((c) => (
              <div key={c.month} className="flex flex-1 flex-col items-center gap-0.5" title={`${c.month}: income ${formatINR(c.income)}, expense ${formatINR(c.expense)}`}>
                <div className="flex h-32 w-full items-end gap-0.5">
                  <div className="flex-1 rounded-t bg-green-700" style={{ height: `${(c.income / maxFlow) * 100}%` }} />
                  <div className="flex-1 rounded-t bg-red-700" style={{ height: `${(c.expense / maxFlow) * 100}%` }} />
                </div>
                <span className="text-[10px] opacity-60">{c.month.slice(5)}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs"><span className="text-green-800">■ Income</span> · <span className="text-red-800">■ Expense</span></p>
        </Card>

        <Card title="Next EMIs">
          {d.dues.length === 0 ? <p className="text-sm opacity-60">Nothing due in the next 45 days.</p> : (
            <ul className="space-y-1 text-sm">
              {d.dues.map((x) => (
                <li key={x.installmentId} className="flex">
                  <span className={x.urgency === 'overdue' ? 'font-semibold text-red-700' : ''}>{x.dueDate} · {x.lender} #{x.installmentNo}{x.urgency === 'overdue' ? ' (overdue)' : ''}</span>
                  <span className="ml-auto tabular-nums">{formatINR(x.emiAmount)}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/dues" className="mt-2 inline-block text-sm underline">All dues →</Link>
        </Card>

        <Card title="Net worth trend">
          {d.trend.length < 2 ? <p className="text-sm opacity-60">The trend builds up as you use WealthWise – one snapshot is saved each day.</p> : (
            <ul className="space-y-1 text-sm">
              {d.trend.slice(-8).map((t) => (
                <li key={t.date} className="flex"><span>{t.date}</span><span className="ml-auto tabular-nums">{formatINR(t.netWorth)}
                  {t.change != null && <span className={t.change >= 0 ? ' text-green-800' : ' text-red-700'}> ({t.change >= 0 ? '+' : ''}{formatINR(t.change)})</span>}</span></li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recurring expenses (3+ of last 6 months)">
          {d.recurring.length === 0 ? <p className="text-sm opacity-60">None yet.</p> : (
            <ul className="space-y-1 text-sm">
              {d.recurring.map((r) => <li key={r.category} className="flex"><span>{r.category}</span><span className="ml-auto tabular-nums">~{formatINR(r.avgAmount)} · {r.months} months</span></li>)}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}