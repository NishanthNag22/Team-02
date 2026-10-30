'use client';

import { useEffect, useState } from 'react';

interface Factor { key: string; label: string; weight: number; value: number; points: number; note: string }
interface Score { score: number; band: string; factors: Factor[]; disclaimer: string; history: { date: string; score: number }[] }

/** Derived credit score with factor breakdown (FR-19). Always shows the "not a bureau score" disclaimer. */
export function ScoreCard({ onScore }: { onScore?: (score: number) => void }) {
  const [s, setS] = useState<Score | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch('/api/insights/score').then(async (r) => {
      if (!r.ok) { setError(true); return; }
      const data: Score = await r.json();
      setS(data);
      onScore?.(data.score);
    });
  }, [onScore]);

  if (error) return <p>Could not load the score.</p>;
  if (!s) return <p>Loading score…</p>;
  const pct = ((s.score - 300) / 600) * 100;

  return (
    <section className="rounded border border-stone-300 bg-white p-4">
      <h2 className="font-semibold">WealthWise score</h2>
      <p role="note" className="mt-1 rounded bg-amber-50 p-2 text-xs text-amber-900">{s.disclaimer}</p>
      <div className="mt-3 flex items-end gap-3">
        <span className="text-4xl font-bold tabular-nums">{s.score}</span>
        <span className="pb-1 text-lg">{s.band}</span>
        <span className="pb-1 text-xs opacity-60">range 300–900</span>
      </div>
      <div className="mt-2 h-2 rounded bg-stone-200" aria-hidden><div className="h-2 rounded bg-green-700" style={{ width: `${pct}%` }} /></div>

      <table className="mt-4 w-full text-sm">
        <thead><tr className="text-left"><th>Factor</th><th>Weight</th><th>Rating</th><th className="text-right">Points</th></tr></thead>
        <tbody>
          {s.factors.map((f) => (
            <tr key={f.key} className="border-t align-top">
              <td className="py-1">{f.label}<div className="text-xs opacity-60">{f.note}</div></td>
              <td>{Math.round(f.weight * 100)}%</td>
              <td>{Math.round(f.value * 100)}%</td>
              <td className="text-right tabular-nums">{f.points} / {Math.round(600 * f.weight)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {s.history.length > 1 && (
        <p className="mt-3 text-xs opacity-70">History: {s.history.map((h) => `${h.date} ${h.score}`).join(' → ')}</p>
      )}
    </section>
  );
}
