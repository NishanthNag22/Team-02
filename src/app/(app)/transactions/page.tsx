'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatINR } from '@/lib/format';
import { TXN_TYPES } from '@/lib/validation/transactions';

interface Txn { id: number; txnType: string; amount: number; txnDate: string; category: string; description: string | null }

const today = () => new Date().toISOString().slice(0, 10);
const EMPTY = { txnType: 'expense', amount: '', txnDate: today(), category: '', description: '' };

export default function TransactionsPage() {
  const [txns, setTxns] = useState<Txn[]>([]);
  const [form, setForm] = useState<Record<string, string>>(EMPTY);
  const [filter, setFilter] = useState({ type: '', from: '', to: '', category: '' });
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});

  const load = useCallback(async () => {
    const qs = new URLSearchParams(Object.entries(filter).filter(([, v]) => v) as [string, string][]);
    const res = await fetch(`/api/transactions?${qs}`);
    if (res.ok) setTxns((await res.json()).transactions);
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setFields({});
    const res = await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, category: form.category || 'Uncategorized' }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setFields(data.fields ?? {}); return; }
    setForm({ ...EMPTY, txnDate: form.txnDate }); load();
  }

  async function remove(id: number) {
    if (!window.confirm('Delete this transaction?')) return;
    await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
    load();
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });
  const setF = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setFilter({ ...filter, [k]: e.target.value });
  const input = 'mt-1 w-full rounded border border-stone-300 bg-white px-2 py-1';
  const err = (k: string) => fields[k] && <span className="text-xs text-red-700">{fields[k][0]}</span>;
  const income = txns.filter((t) => t.txnType === 'income').reduce((s, t) => s + t.amount, 0);
  const expense = txns.filter((t) => t.txnType === 'expense').reduce((s, t) => s + t.amount, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold">Ledger</h1>

      <form onSubmit={add} className="mt-6 grid grid-cols-2 gap-3 rounded border border-stone-300 bg-white p-4 md:grid-cols-6">
        <label className="text-sm">Type
          <select value={form.txnType} onChange={set('txnType')} className={input}>
            {TXN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="text-sm">Amount (₹)<input required type="number" step="0.01" value={form.amount} onChange={set('amount')} className={input} />{err('amount')}</label>
        <label className="text-sm">Date<input required type="date" value={form.txnDate} onChange={set('txnDate')} className={input} />{err('txnDate')}</label>
        <label className="text-sm">Category<input value={form.category} onChange={set('category')} placeholder="e.g. Groceries" className={input} />{err('category')}</label>
        <label className="text-sm md:col-span-2">Description<input value={form.description} onChange={set('description')} className={input} /></label>
        <div className="col-span-2 flex items-center gap-3 md:col-span-6">
          <button className="rounded bg-amber-700 px-4 py-2 text-white">Add transaction</button>
          {error && <span className="text-sm text-red-700">{error}</span>}
        </div>
      </form>

      <div className="mt-6 flex flex-wrap items-end gap-3 text-sm">
        <label>Type<select value={filter.type} onChange={setF('type')} className={input}><option value="">All</option>{TXN_TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
        <label>From<input type="date" value={filter.from} onChange={setF('from')} className={input} /></label>
        <label>To<input type="date" value={filter.to} onChange={setF('to')} className={input} /></label>
        <label>Category<input value={filter.category} onChange={setF('category')} className={input} /></label>
        <span className="ml-auto">Income <b className="text-green-800">{formatINR(income)}</b> · Expense <b className="text-red-800">{formatINR(expense)}</b></span>
      </div>

      <table className="mt-3 w-full border-collapse bg-white text-sm">
        <thead><tr className="border-b text-left"><th className="p-2">Date</th><th className="p-2">Type</th><th className="p-2">Category</th><th className="p-2">Description</th><th className="p-2 text-right">Amount</th><th className="p-2"></th></tr></thead>
        <tbody>
          {txns.map((t) => (
            <tr key={t.id} className="border-b">
              <td className="p-2">{t.txnDate}</td><td className="p-2">{t.txnType}</td><td className="p-2">{t.category}</td>
              <td className="p-2">{t.description}</td><td className="p-2 text-right tabular-nums">{formatINR(t.amount)}</td>
              <td className="p-2 text-right"><button onClick={() => remove(t.id)} className="text-red-700 underline">Delete</button></td>
            </tr>
          ))}
          {txns.length === 0 && <tr><td colSpan={6} className="p-4 text-center opacity-60">No transactions match.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}