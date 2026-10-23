'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatINR } from '@/lib/format';
import { LOAN_TYPES } from '@/lib/validation/loans';

interface Loan {
  id: number; loanType: string; lender: string; principal: number; interestRate: number; interestType: string;
  tenureMonths: number; startDate: string; status: string; emiAmount: number; paidCount: number; outstanding: number; nextDueDate: string | null;
}

const EMPTY = { loanType: 'home', lender: '', principal: '', interestRate: '', interestType: 'fixed', tenureMonths: '', startDate: '' };
const label = (t: string) => t.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [form, setForm] = useState<Record<string, string>>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});

  const load = useCallback(async () => {
    const res = await fetch('/api/loans');
    if (res.ok) setLoans((await res.json()).loans);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setFields({});
    const res = await fetch('/api/loans', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setFields(data.fields ?? {}); return; }
    setForm(EMPTY); load();
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });
  const input = 'mt-1 w-full rounded border border-stone-300 bg-white px-2 py-1';
  const err = (k: string) => fields[k] && <span className="text-xs text-red-700">{fields[k][0]}</span>;
  const totalOutstanding = loans.filter((l) => l.status === 'active').reduce((s, l) => s + l.outstanding, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold">Loans</h1>
      <p className="mt-1 opacity-70">Total outstanding: <b>{formatINR(totalOutstanding)}</b></p>

      <form onSubmit={add} className="mt-6 grid grid-cols-2 gap-3 rounded border border-stone-300 bg-white p-4 md:grid-cols-4">
        <label className="text-sm">Type<select value={form.loanType} onChange={set('loanType')} className={input}>{LOAN_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}</select></label>
        <label className="text-sm">Lender<input required value={form.lender} onChange={set('lender')} className={input} />{err('lender')}</label>
        <label className="text-sm">Principal (₹)<input required type="number" step="0.01" value={form.principal} onChange={set('principal')} className={input} />{err('principal')}</label>
        <label className="text-sm">Interest rate (% p.a.)<input required type="number" step="0.01" value={form.interestRate} onChange={set('interestRate')} className={input} />{err('interestRate')}</label>
        <label className="text-sm">Interest type<select value={form.interestType} onChange={set('interestType')} className={input}><option value="fixed">Fixed</option><option value="floating">Floating</option></select></label>
        <label className="text-sm">Tenure (months)<input required type="number" value={form.tenureMonths} onChange={set('tenureMonths')} className={input} />{err('tenureMonths')}</label>
        <label className="text-sm">Start date<input required type="date" value={form.startDate} onChange={set('startDate')} className={input} />{err('startDate')}</label>
        <div className="flex items-end gap-3"><button className="rounded bg-amber-700 px-4 py-2 text-white">Add loan</button></div>
        {error && <p className="col-span-2 text-sm text-red-700 md:col-span-4">{error}</p>}
      </form>

      <table className="mt-6 w-full border-collapse bg-white text-sm">
        <thead><tr className="border-b text-left"><th className="p-2">Lender</th><th className="p-2">Type</th><th className="p-2 text-right">Principal</th><th className="p-2 text-right">Rate</th><th className="p-2 text-right">EMI</th><th className="p-2">Paid</th><th className="p-2 text-right">Outstanding</th><th className="p-2">Next due</th><th className="p-2">Status</th></tr></thead>
        <tbody>
          {loans.map((l) => (
            <tr key={l.id} className="border-b">
              <td className="p-2">{l.lender}</td><td className="p-2">{label(l.loanType)}</td>
              <td className="p-2 text-right tabular-nums">{formatINR(l.principal)}</td>
              <td className="p-2 text-right">{l.interestRate}% {l.interestType}</td>
              <td className="p-2 text-right tabular-nums">{formatINR(l.emiAmount)}</td>
              <td className="p-2">{l.paidCount} / {l.tenureMonths}</td>
              <td className="p-2 text-right tabular-nums">{formatINR(l.outstanding)}</td>
              <td className="p-2">{l.nextDueDate ?? '—'}</td><td className="p-2">{l.status}</td>
            </tr>
          ))}
          {loans.length === 0 && <tr><td colSpan={9} className="p-4 text-center opacity-60">No loans yet – add one above.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
