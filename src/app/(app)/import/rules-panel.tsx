'use client';

import { useCallback, useEffect, useState } from 'react';

interface Rule { id: number; keyword: string; category: string; txnType: string; priority: number; isSystem: boolean }

/** Manage categorisation rules (FR-15). */
export function RulesPanel() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [form, setForm] = useState({ keyword: '', category: '', txnType: 'expense' });
  const [message, setMessage] = useState<string | null>(null);
  const [showSystem, setShowSystem] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/rules');
    if (res.ok) setRules((await res.json()).rules);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch('/api/rules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const data = await res.json();
    setMessage(res.ok ? `Rule added – ${data.recategorised} existing transaction(s) re-categorised.` : (data.fields?.keyword?.[0] ?? data.error));
    if (res.ok) { setForm({ keyword: '', category: '', txnType: 'expense' }); load(); }
  }

  async function remove(id: number) {
    await fetch(`/api/rules/${id}`, { method: 'DELETE' });
    load();
  }

  const mine = rules.filter((r) => !r.isSystem);
  const system = rules.filter((r) => r.isSystem);
  const input = 'rounded border border-stone-300 bg-white px-2 py-1';

  return (
    <section className="rounded border border-stone-300 bg-white p-4">
      <h2 className="font-semibold">Categorisation rules</h2>
      <p className="text-sm opacity-70">If a description contains the keyword, it gets the category. Your rules win over the built-in ones.</p>
      <form onSubmit={add} className="mt-3 flex flex-wrap items-end gap-2 text-sm">
        <input required placeholder="Keyword e.g. AMAZON" value={form.keyword} onChange={(e) => setForm({ ...form, keyword: e.target.value })} className={input} />
        <input required placeholder="Category e.g. Business" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={input} />
        <select value={form.txnType} onChange={(e) => setForm({ ...form, txnType: e.target.value })} className={input}>
          <option value="expense">expense</option><option value="income">income</option><option value="loan">loan</option><option value="asset">asset</option>
        </select>
        <button className="rounded bg-amber-700 px-3 py-1 text-white">Add rule</button>
        {message && <span>{message}</span>}
      </form>
      <ul className="mt-3 space-y-1 text-sm">
        {mine.map((r) => (
          <li key={r.id} className="flex"><span><b>{r.keyword}</b> → {r.category} ({r.txnType})</span>
            <button onClick={() => remove(r.id)} className="ml-auto text-red-700 underline">Delete</button></li>
        ))}
        {mine.length === 0 && <li className="opacity-60">No rules of your own yet.</li>}
      </ul>
      <button onClick={() => setShowSystem(!showSystem)} className="mt-2 text-sm underline">{showSystem ? 'Hide' : 'Show'} {system.length} built-in rules</button>
      {showSystem && (
        <ul className="mt-2 grid grid-cols-2 gap-1 text-xs opacity-80 md:grid-cols-3">
          {system.map((r) => <li key={r.id}>{r.keyword} → {r.category}</li>)}
        </ul>
      )}
    </section>
  );
}
