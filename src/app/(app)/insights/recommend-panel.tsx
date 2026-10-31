'use client';

import { useState } from 'react';
import { formatINR } from '@/lib/format';

interface Offer {
  productId: number; lender: string; productName: string; eligible: boolean; reasons: string[];
  rate: number | null; emi: number | null; totalInterest: number | null; processingFee: number | null; totalCost: number | null; rank: number | null;
}

const TYPES = ['home', 'vehicle', 'personal', 'education', 'gold', 'business', 'credit_card'];

/** Compare loan products for a planned loan (FR-20). */
export function RecommendPanel() {
  const [form, setForm] = useState({ loanType: 'home', amount: '2500000', tenureMonths: '240' });
  const [data, setData] = useState<{ score: number; offers: Offer[]; note: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/insights/recommend', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ loanType: form.loanType, amount: Number(form.amount), tenureMonths: Number(form.tenureMonths) }),
    });
    const body = await res.json();
    if (res.ok) { setData(body); setError(null); } else setError(body.fields ? Object.values(body.fields).flat().join(' ') : body.error);
  }

  const input = 'rounded border border-stone-300 bg-white px-2 py-1';
  return (
    <section className="rounded border border-stone-300 bg-white p-4 text-sm">
      <h2 className="font-semibold">Compare loan products</h2>
      <form onSubmit={submit} className="mt-2 flex flex-wrap items-end gap-2">
        <label>Type <select value={form.loanType} onChange={(e) => setForm({ ...form, loanType: e.target.value })} className={input}>
          {TYPES.map((t) => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}</select></label>
        <label>Amount ₹ <input type="number" min={1} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={`${input} w-32`} /></label>
        <label>Tenure (months) <input type="number" min={1} max={480} value={form.tenureMonths} onChange={(e) => setForm({ ...form, tenureMonths: e.target.value })} className={`${input} w-20`} /></label>
        <button className="rounded bg-amber-700 px-3 py-1 text-white">Compare</button>
      </form>
      {error && <p role="alert" className="mt-2 text-red-700">{error}</p>}
      {data && (
        <>
          <p className="mt-3 text-xs opacity-70">Priced for your WealthWise score {data.score}. {data.note}</p>
          <table className="mt-2 w-full">
            <thead><tr className="text-left"><th>#</th><th>Product</th><th className="text-right">Rate</th><th className="text-right">EMI</th><th className="text-right">Interest</th><th className="text-right">Fee</th><th className="text-right">Total cost</th></tr></thead>
            <tbody>
              {data.offers.map((o) => o.eligible ? (
                <tr key={o.productId} className="border-t tabular-nums">
                  <td>{o.rank}</td><td>{o.lender} – {o.productName}</td><td className="text-right">{o.rate}%</td>
                  <td className="text-right">{formatINR(o.emi!)}</td><td className="text-right">{formatINR(o.totalInterest!)}</td>
                  <td className="text-right">{formatINR(o.processingFee!)}</td><td className="text-right font-semibold">{formatINR(o.totalCost!)}</td>
                </tr>
              ) : (
                <tr key={o.productId} className="border-t opacity-60">
                  <td>–</td><td>{o.lender} – {o.productName}</td><td colSpan={5}>Not eligible: {o.reasons.join('; ')}</td>
                </tr>
              ))}
              {data.offers.length === 0 && <tr><td colSpan={7} className="opacity-60">No products of this type in the catalogue.</td></tr>}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
