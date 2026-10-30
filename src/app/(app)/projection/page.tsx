'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatINR } from '@/lib/format';

interface Point { month: number; assets: number; liabilities: number; netWorth: number }
interface Result {
  assumptions: { months: number; growthPct: number; monthlySurplus: number; surplusSource: string };
  loans: { id: number; lender: string; outstanding: number; remainingInterest: number }[];
  baseline: Point[];
  scenario: { closeLoanId: number; lender: string; points: Point[]; difference: number } | null;
}

const compact = (v: number) => (Math.abs(v) >= 1e7 ? `₹${(v / 1e7).toFixed(2)} Cr` : Math.abs(v) >= 1e5 ? `₹${(v / 1e5).toFixed(2)} L` : formatINR(v, 0));

/** Simple SVG line chart: solid = current plan, dashed = scenario. A table below gives the same numbers (NFR-05). */
function Chart({ base, scenario }: { base: Point[]; scenario?: Point[] }) {
  const W = 640, H = 220, P = 8;
  const all = [...base, ...(scenario ?? [])].map((p) => p.netWorth);
  const min = Math.min(0, ...all), max = Math.max(1, ...all);
  const x = (m: number) => P + (m / (base.length - 1)) * (W - 2 * P);
  const y = (v: number) => H - P - ((v - min) / (max - min || 1)) * (H - 2 * P);
  const line = (pts: Point[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.month).toFixed(1)},${y(p.netWorth).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Projected net worth by month">
      <line x1={P} x2={W - P} y1={y(0)} y2={y(0)} stroke="#a8a29e" strokeDasharray="2 3" />
      <path d={line(base)} fill="none" stroke="#3f6a92" strokeWidth={2.5} />
      {scenario && <path d={line(scenario)} fill="none" stroke="#5f8449" strokeWidth={2.5} strokeDasharray="7 4" />}
    </svg>
  );
}

export default function ProjectionPage() {
  const [form, setForm] = useState({ months: '60', growthPct: '8', monthlySurplus: '', closeLoanId: '' });
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async (f: typeof form) => {
    const res = await fetch(`/api/insights/projection?${new URLSearchParams(f)}`);
    const body = await res.json();
    if (res.ok) { setData(body); setError(null); }
    else setError(body.fields ? Object.values(body.fields).flat().join(' ') : body.error);
  }, []);
  useEffect(() => { run({ months: '60', growthPct: '8', monthlySurplus: '', closeLoanId: '' }); }, [run]);

  const input = 'w-full rounded border border-stone-300 bg-white px-2 py-1';
  const end = data?.baseline[data.baseline.length - 1];
  const yearly = data ? data.baseline.filter((p) => p.month % 12 === 0 || p.month === data.baseline.length - 1) : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">What-if projection</h1>
      <p className="text-sm opacity-70">An estimate from your current assets, loans and average monthly surplus. It is not a forecast or financial advice.</p>

      <form onSubmit={(e) => { e.preventDefault(); run(form); }} className="grid grid-cols-2 gap-3 rounded border border-stone-300 bg-white p-4 text-sm md:grid-cols-5">
        <label>Months (6–360)<input type="number" min={6} max={360} value={form.months} onChange={(e) => setForm({ ...form, months: e.target.value })} className={input} /></label>
        <label>Asset growth % a year (0–30)<input type="number" step="0.1" min={0} max={30} value={form.growthPct} onChange={(e) => setForm({ ...form, growthPct: e.target.value })} className={input} /></label>
        <label>Monthly surplus ₹<input type="number" placeholder={data ? String(data.assumptions.monthlySurplus) : ''} value={form.monthlySurplus} onChange={(e) => setForm({ ...form, monthlySurplus: e.target.value })} className={input} /></label>
        <label>Close a loan today
          <select value={form.closeLoanId} onChange={(e) => setForm({ ...form, closeLoanId: e.target.value })} className={input}>
            <option value="">— none —</option>
            {data?.loans.map((l) => <option key={l.id} value={l.id}>{l.lender} ({compact(l.outstanding)})</option>)}
          </select>
        </label>
        <button className="self-end rounded bg-amber-700 px-3 py-1.5 text-white">Project</button>
      </form>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}

      {data && end && (
        <section className="space-y-3 rounded border border-stone-300 bg-white p-4">
          <p className="text-sm">Surplus used: <b>{formatINR(data.assumptions.monthlySurplus)}</b>/month ({data.assumptions.surplusSource}).
            In {data.assumptions.months} months your net worth would be <b>{formatINR(end.netWorth)}</b>.</p>
          {data.scenario && (
            <p className="text-sm">Closing <b>{data.scenario.lender}</b> today changes that by{' '}
              <b className={data.scenario.difference >= 0 ? 'text-green-800' : 'text-red-700'}>{data.scenario.difference >= 0 ? '+' : ''}{formatINR(data.scenario.difference)}</b>.</p>
          )}
          <Chart base={data.baseline} scenario={data.scenario?.points} />
          <p className="text-xs"><span className="text-[#3f6a92]">━ Current plan</span>{data.scenario && <span className="text-[#5f8449]"> ╍ With {data.scenario.lender} closed</span>}</p>
          <table className="w-full text-sm">
            <thead><tr className="text-left"><th>Month</th><th className="text-right">Assets</th><th className="text-right">Loans</th><th className="text-right">Net worth</th>{data.scenario && <th className="text-right">Scenario</th>}</tr></thead>
            <tbody>
              {yearly.map((p) => (
                <tr key={p.month} className="border-t tabular-nums">
                  <td>{p.month}</td><td className="text-right">{compact(p.assets)}</td><td className="text-right">{compact(p.liabilities)}</td>
                  <td className="text-right">{compact(p.netWorth)}</td>
                  {data.scenario && <td className="text-right">{compact(data.scenario.points[p.month].netWorth)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
