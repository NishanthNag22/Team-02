'use client';

import { useEffect, useState } from 'react';
import { formatINR } from '@/lib/format';

interface Option { emiBefore: number; emiAfter: number; monthsBefore: number; monthsAfter: number; interestSaved: number; outstandingAfter: number; lastDueDate: string }
interface Simulation { outstanding: number; reduceTenure: Option; reduceEmi: Option }
interface Asset { id: number; name: string; currentValue: number; liquidity: string }

/** Compare "reduce tenure" vs "reduce EMI", then apply one (FR-11). */
export function PrepayPanel({ loanId, onApplied }: { loanId: number; onApplied: () => void }) {
  const [amount, setAmount] = useState('');
  const [sim, setSim] = useState<Simulation | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [fundingAssetId, setFundingAssetId] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/assets').then(async (r) => { if (r.ok) setAssets((await r.json()).assets); });
  }, []);

  async function simulate(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null); setSim(null);
    const res = await fetch(`/api/loans/${loanId}/prepay/simulate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: Number(amount) }) });
    const data = await res.json();
    if (res.ok) setSim(data); else setMessage(data.fields?.amount?.[0] ?? data.error);
  }

  async function apply(mode: 'reduce_tenure' | 'reduce_emi') {
    if (!window.confirm(`Apply a prepayment of ${formatINR(Number(amount))}? The remaining schedule will be recalculated.`)) return;
    setBusy(true);
    const res = await fetch(`/api/loans/${loanId}/prepay`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Number(amount), mode, fundingAssetId: fundingAssetId ? Number(fundingAssetId) : null }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok) {
      setMessage(`Prepayment applied – interest saved ${formatINR(data.interestSaved)}.`);
      setSim(null); setAmount(''); setFundingAssetId(''); onApplied();
    } else setMessage(data.error);
  }

  const col = (title: string, o: Option, mode: 'reduce_tenure' | 'reduce_emi') => (
    <div className="rounded border border-stone-300 p-3">
      <h3 className="font-semibold">{title}</h3>
      <dl className="mt-2 grid grid-cols-2 gap-1 tabular-nums">
        <dt>EMI</dt><dd className="text-right">{formatINR(o.emiBefore)} → <b>{formatINR(o.emiAfter)}</b></dd>
        <dt>Installments left</dt><dd className="text-right">{o.monthsBefore} → <b>{o.monthsAfter}</b></dd>
        <dt>Last EMI</dt><dd className="text-right">{o.lastDueDate}</dd>
        <dt>Interest saved</dt><dd className="text-right font-semibold text-green-800">{formatINR(o.interestSaved)}</dd>
      </dl>
      <button disabled={busy} onClick={() => apply(mode)} className="mt-3 rounded bg-amber-700 px-3 py-1 text-white disabled:opacity-50">Apply this option</button>
    </div>
  );

  return (
    <section className="mt-6 rounded border border-stone-300 bg-white p-4 text-sm">
      <h2 className="font-semibold">Prepayment</h2>
      <form onSubmit={simulate} className="mt-2 flex flex-wrap items-end gap-2">
        <label>Amount ₹<input required type="number" min={1} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="ml-1 w-36 rounded border border-stone-300 px-2 py-1" /></label>
        <label>Pay from asset (optional)
          <select value={fundingAssetId} onChange={(e) => setFundingAssetId(e.target.value)} className="ml-1 rounded border border-stone-300 px-2 py-1">
            <option value="">— not from an asset —</option>
            {assets.map((a) => <option key={a.id} value={a.id}>{a.name} ({formatINR(a.currentValue)})</option>)}
          </select>
        </label>
        <button className="rounded border px-3 py-1">Compare options</button>
      </form>
      {message && <p role="status" className="mt-2">{message}</p>}
      {sim && (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {col('Reduce tenure (same EMI)', sim.reduceTenure, 'reduce_tenure')}
          {col('Reduce EMI (same end date)', sim.reduceEmi, 'reduce_emi')}
        </div>
      )}
    </section>
  );
}
