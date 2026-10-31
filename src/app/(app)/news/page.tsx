'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatINR } from '@/lib/format';

interface Article { id: string; title: string; link: string; summary: string; category: string; rateChangeBps: number | null; publishedAt: string; illustrative: boolean }
interface Impact { loanId: number; lender: string; rate: number; newRate: number; emiBefore: number; emiAfter: number; change: number }

const CATEGORIES = ['Monetary Policy', 'Banking', 'Regulation', 'Markets', 'Other'];

/** RBI news with the EMI impact of rate changes (FR-25). */
export default function NewsPage() {
  const [category, setCategory] = useState('');
  const [data, setData] = useState<{ source: string; notice: string | null; articles: Article[] } | null>(null);
  const [impact, setImpact] = useState<Record<string, { impacts: Impact[]; note: string }>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (c: string) => {
    const res = await fetch(`/api/news${c ? `?category=${encodeURIComponent(c)}` : ''}`);
    const body = await res.json();
    if (res.ok) { setData(body); setError(null); } else setError(body.error);
  }, []);
  useEffect(() => { load(''); }, [load]);

  async function showImpact(a: Article) {
    const res = await fetch(`/api/news/${encodeURIComponent(a.id)}/impact`);
    const body = await res.json();
    if (res.ok) setImpact({ ...impact, [a.id]: body });
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">RBI news</h1>
      <div className="flex flex-wrap gap-2 text-sm">
        {['', ...CATEGORIES].map((c) => (
          <button key={c || 'all'} onClick={() => { setCategory(c); load(c); }} aria-pressed={category === c}
            className={`rounded border px-3 py-1 ${category === c ? 'bg-amber-700 text-white' : 'border-stone-300 bg-white'}`}>{c || 'All'}</button>
        ))}
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {data?.notice && <p role="status" className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{data.notice}</p>}

      <ul className="space-y-3">
        {data?.articles.map((a) => (
          <li key={a.id} className="rounded border border-stone-300 bg-white p-4 text-sm">
            <div className="flex flex-wrap items-center gap-2 text-xs opacity-70">
              <span className="rounded bg-stone-200 px-1.5">{a.category}</span>
              <span>{new Date(a.publishedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              {a.illustrative && <span className="font-semibold text-amber-800">Illustrative sample</span>}
            </div>
            <h2 className="mt-1 font-semibold">{a.link ? <a href={a.link} target="_blank" rel="noreferrer" className="underline">{a.title}</a> : a.title}</h2>
            {a.summary && <p className="mt-1 opacity-80">{a.summary}</p>}
            {a.rateChangeBps != null && (
              <div className="mt-2">
                <span className="font-medium">Repo rate {a.rateChangeBps === 0 ? 'unchanged' : `${a.rateChangeBps > 0 ? '+' : ''}${a.rateChangeBps} bps`}</span>
                {!impact[a.id] && <button onClick={() => showImpact(a)} className="ml-3 underline">What does this mean for my EMIs?</button>}
                {impact[a.id] && (
                  <div className="mt-2">
                    {impact[a.id].impacts.length > 0 && (
                      <table className="w-full tabular-nums">
                        <thead><tr className="text-left"><th>Loan</th><th>Rate</th><th className="text-right">EMI now</th><th className="text-right">New EMI</th><th className="text-right">Change / month</th></tr></thead>
                        <tbody>{impact[a.id].impacts.map((i) => (
                          <tr key={i.loanId} className="border-t"><td>{i.lender}</td><td>{i.rate}% → {i.newRate}%</td>
                            <td className="text-right">{formatINR(i.emiBefore)}</td><td className="text-right">{formatINR(i.emiAfter)}</td>
                            <td className={`text-right ${i.change > 0 ? 'text-red-700' : 'text-green-800'}`}>{i.change > 0 ? '+' : ''}{formatINR(i.change)}</td></tr>
                        ))}</tbody>
                      </table>
                    )}
                    <p className="mt-1 text-xs opacity-70">{impact[a.id].note}</p>
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
        {data && data.articles.length === 0 && <li className="text-sm opacity-60">No articles in this category.</li>}
      </ul>
    </div>
  );
}
