'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatINR } from '@/lib/format';

interface Client { id: number; name: string; email: string; totalAssets: number; totalLiabilities: number; netWorth: number; activeLoans: number; overdueEmis: number }
interface Detail {
  client: Client;
  assets: { id: number; name: string; assetType: string; currentValue: number }[];
  loans: { id: number; lender: string; loanType: string; status: string; emiAmount: number; outstanding: number }[];
}
interface Advisor { id: number; name: string; email: string }

/** Individuals pick an advisor here; advisors see their assigned clients (FR-26). */
export default function AdvisorPage() {
  const [role, setRole] = useState<string | null>(null);
  useEffect(() => { fetch('/api/auth/me').then(async (r) => setRole((await r.json()).user?.role ?? null)); }, []);
  if (!role) return <p>Loading…</p>;
  return role === 'advisor' ? <AdvisorView /> : <IndividualView />;
}

function IndividualView() {
  const [advisor, setAdvisor] = useState<Advisor | null>(null);
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch('/api/advisor/me');
    if (r.ok) setAdvisor((await r.json()).advisor);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function choose(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch('/api/advisor/me', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email }) });
    const body = await r.json();
    if (r.ok) { setAdvisor(body.advisor); setEmail(''); setMessage('Advisor saved.'); } else setMessage(body.fields?.email?.[0] ?? body.error);
  }

  async function remove() {
    if (!window.confirm('Stop sharing your summary with this advisor?')) return;
    await fetch('/api/advisor/me', { method: 'DELETE' });
    setAdvisor(null);
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">My advisor</h1>
      <section className="rounded border border-stone-300 bg-white p-4 text-sm">
        {advisor ? (
          <p>Your advisor is <b>{advisor.name}</b> ({advisor.email}). They can see your net worth summary, assets and loans, but cannot change anything.{' '}
            <button onClick={remove} className="text-red-700 underline">Remove</button></p>
        ) : <p>You have not chosen an advisor. An advisor can view (not change) your summary, assets and loans.</p>}
        <form onSubmit={choose} className="mt-3 flex flex-wrap gap-2">
          <input required type="email" placeholder="advisor@example.com" aria-label="Advisor email" value={email} onChange={(e) => setEmail(e.target.value)} className="rounded border border-stone-300 bg-white px-2 py-1" />
          <button className="rounded bg-amber-700 px-3 py-1 text-white">{advisor ? 'Change advisor' : 'Choose advisor'}</button>
          {message && <span role="status">{message}</span>}
        </form>
      </section>
    </div>
  );
}

function AdvisorView() {
  const [clients, setClients] = useState<Client[] | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);

  useEffect(() => { fetch('/api/advisor/clients').then(async (r) => r.ok && setClients((await r.json()).clients)); }, []);

  async function open(id: number) {
    const r = await fetch(`/api/advisor/clients/${id}`);
    if (r.ok) setDetail(await r.json());
  }

  if (!clients) return <p>Loading…</p>;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My clients</h1>
      <table className="w-full rounded bg-white text-sm tabular-nums">
        <thead><tr className="border-b text-left"><th className="p-2">Client</th><th className="p-2 text-right">Assets</th><th className="p-2 text-right">Liabilities</th><th className="p-2 text-right">Net worth</th><th className="p-2">Loans</th><th className="p-2">Overdue EMIs</th><th></th></tr></thead>
        <tbody>
          {clients.map((c) => (
            <tr key={c.id} className="border-b">
              <td className="p-2">{c.name}<div className="text-xs opacity-60">{c.email}</div></td>
              <td className="p-2 text-right">{formatINR(c.totalAssets)}</td><td className="p-2 text-right">{formatINR(c.totalLiabilities)}</td>
              <td className={`p-2 text-right font-semibold ${c.netWorth < 0 ? 'text-red-700' : ''}`}>{formatINR(c.netWorth)}</td>
              <td className="p-2">{c.activeLoans}</td>
              <td className={`p-2 ${c.overdueEmis ? 'font-semibold text-red-700' : ''}`}>{c.overdueEmis}</td>
              <td className="p-2"><button onClick={() => open(c.id)} className="underline">View</button></td>
            </tr>
          ))}
          {clients.length === 0 && <tr><td colSpan={7} className="p-2 opacity-60">No clients have chosen you yet. Clients add you from their Advisor page using your email.</td></tr>}
        </tbody>
      </table>

      {detail && (
        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded border border-stone-300 bg-white p-4 text-sm">
            <h2 className="font-semibold">{detail.client.name} – assets</h2>
            <ul className="mt-2 space-y-1">{detail.assets.map((a) => <li key={a.id} className="flex"><span>{a.name} ({a.assetType})</span><span className="ml-auto tabular-nums">{formatINR(a.currentValue)}</span></li>)}
              {detail.assets.length === 0 && <li className="opacity-60">No assets.</li>}</ul>
          </div>
          <div className="rounded border border-stone-300 bg-white p-4 text-sm">
            <h2 className="font-semibold">{detail.client.name} – loans</h2>
            <ul className="mt-2 space-y-1">{detail.loans.map((l) => <li key={l.id} className="flex"><span>{l.lender} ({l.loanType}, {l.status})</span><span className="ml-auto tabular-nums">EMI {formatINR(l.emiAmount)} · {formatINR(l.outstanding)} left</span></li>)}
              {detail.loans.length === 0 && <li className="opacity-60">No loans.</li>}</ul>
          </div>
        </section>
      )}
    </div>
  );
}
