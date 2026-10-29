'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatINR } from '@/lib/format';

interface Report {
  year: number; label: string; from: string; to: string; availableYears: number[];
  summary: { income: number; expense: number; net: number; savingsRatePct: number | null; loanPayments: number; transactions: number };
  categories: { category: string; total: number; count: number; pct: number }[];
  monthly: { month: string; income: number; expense: number }[];
  loans: { loanId: number; loanType: string; lender: string; emis: number; principalPaid: number; interestPaid: number }[];
  taxHints: { section: string; title: string; eligibleAmount: number; limit: number | null; claimable: number; note: string }[];
  disclaimer: string;
}

const fy = (y: number) => `FY ${y}-${String((y + 1) % 100).padStart(2, '0')}`;

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded border border-stone-300 bg-white p-4 text-sm"><h2 className="mb-2 font-semibold">{title}</h2>{children}</section>;
}

/** Financial-year report (FR-22) and PDF statement download (FR-23). */
export default function ReportsPage() {
  const [r, setR] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (year?: number) => {
    const res = await fetch(`/api/reports/fy${year ? `?year=${year}` : ''}`);
    const body = await res.json();
    if (res.ok) { setR(body); setError(null); } else setError(body.error);
  }, []);
  useEffect(() => { load(); }, [load]);

  if (error) return <p role="alert">{error}</p>;
  if (!r) return <p>Loading…</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Reports</h1>
        <label className="text-sm">Financial year{' '}
          <select value={r.year} onChange={(e) => load(Number(e.target.value))} className="rounded border border-stone-300 bg-white px-2 py-1">
            {r.availableYears.map((y) => <option key={y} value={y}>{fy(y)}</option>)}
          </select>
        </label>
        <span className="text-xs opacity-60">{r.from} to {r.to}</span>
        <a href="/api/reports/statement" className="ml-auto rounded bg-amber-700 px-3 py-1.5 text-sm text-white">Download PDF statement</a>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[['Income', r.summary.income], ['Expenses', r.summary.expense], ['Net saving', r.summary.net], ['EMIs & prepayments', r.summary.loanPayments]].map(([t, v]) => (
          <div key={t as string} className="rounded border border-stone-300 bg-white p-4">
            <div className="text-xs uppercase opacity-60">{t}</div>
            <div className={`mt-1 text-xl font-semibold tabular-nums ${(v as number) < 0 ? 'text-red-700' : ''}`}>{formatINR(v as number)}</div>
          </div>
        ))}
      </div>
      <p className="text-sm">Savings rate: <b>{r.summary.savingsRatePct == null ? '—' : `${r.summary.savingsRatePct}%`}</b> · {r.summary.transactions} transactions</p>

      <div className="grid gap-6 md:grid-cols-2">
        <Card title="Spending by category">
          {r.categories.length === 0 ? <p className="opacity-60">No expenses in this year.</p> : (
            <ul className="space-y-1">
              {r.categories.map((c) => (
                <li key={c.category}>
                  <div className="flex"><span>{c.category}</span><span className="ml-auto tabular-nums">{formatINR(c.total)} · {c.pct}%</span></div>
                  <div className="h-1.5 rounded bg-stone-200"><div className="h-1.5 rounded bg-amber-700" style={{ width: `${c.pct}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Loan repayments this year">
          {r.loans.length === 0 ? <p className="opacity-60">No EMIs paid in this year.</p> : (
            <table className="w-full tabular-nums">
              <thead><tr className="text-left"><th>Loan</th><th>EMIs</th><th className="text-right">Principal</th><th className="text-right">Interest</th></tr></thead>
              <tbody>{r.loans.map((l) => (
                <tr key={l.loanId} className="border-t"><td>{l.lender} ({l.loanType})</td><td>{l.emis}</td>
                  <td className="text-right">{formatINR(l.principalPaid)}</td><td className="text-right">{formatINR(l.interestPaid)}</td></tr>
              ))}</tbody>
            </table>
          )}
        </Card>

        <Card title="Indicative tax hints">
          {r.taxHints.length === 0 ? <p className="opacity-60">No home or education loan repayments in this year.</p> : (
            <ul className="space-y-2">
              {r.taxHints.map((h) => (
                <li key={h.section}><b>Section {h.section}</b> – {h.title}: paid {formatINR(h.eligibleAmount)}, up to <b>{formatINR(h.claimable)}</b> may be claimable
                  {h.limit != null && ` (limit ${formatINR(h.limit, 0)})`}.<div className="text-xs opacity-60">{h.note}</div></li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs opacity-70">{r.disclaimer}</p>
        </Card>

        <Card title="Month by month">
          <table className="w-full tabular-nums">
            <thead><tr className="text-left"><th>Month</th><th className="text-right">Income</th><th className="text-right">Expense</th></tr></thead>
            <tbody>{r.monthly.map((m) => (
              <tr key={m.month} className="border-t"><td>{m.month}</td><td className="text-right">{formatINR(m.income)}</td><td className="text-right">{formatINR(m.expense)}</td></tr>
            ))}</tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
