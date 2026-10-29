'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatINR } from '@/lib/format';
import { ASSET_TYPES } from '@/lib/validation/assets';

interface Asset {
  id: number; name: string; assetType: string; liquidity: string;
  purchaseValue: number; currentValue: number; purchaseDate: string; valuationDate: string; notes: string | null;
}

const EMPTY = { name: '', assetType: 'fd', liquidity: '', purchaseValue: '', currentValue: '', purchaseDate: '', valuationDate: '', notes: '' };
const SPECIAL: Record<string, string> = { fd: 'FD', epf: 'EPF', ppf: 'PPF' };
const label = (t: string) => SPECIAL[t] ?? t.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function AssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [form, setForm] = useState<Record<string, string>>(EMPTY);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState<Record<string, string[]>>({});

  const load = useCallback(async () => {
    const res = await fetch('/api/assets');
    if (res.ok) setAssets((await res.json()).assets);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setFields({});
    const body = { ...form, liquidity: form.liquidity || undefined };
    const res = await fetch(editingId ? `/api/assets/${editingId}` : '/api/assets', {
      method: editingId ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); setFields(data.fields ?? {}); return; }
    setForm(EMPTY); setEditingId(null); load();
  }

  async function remove(id: number) {
    if (!window.confirm('Delete this asset?')) return;
    await fetch(`/api/assets/${id}`, { method: 'DELETE' });
    load();
  }

  function edit(a: Asset) {
    setEditingId(a.id);
    setForm({
      name: a.name, assetType: a.assetType, liquidity: a.liquidity,
      purchaseValue: String(a.purchaseValue), currentValue: String(a.currentValue),
      purchaseDate: a.purchaseDate, valuationDate: a.valuationDate, notes: a.notes ?? '',
    });
  }

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [k]: e.target.value });
  const input = 'mt-1 w-full rounded border border-stone-300 bg-white px-2 py-1';
  const err = (k: string) => fields[k] && <span className="text-xs text-red-700">{fields[k][0]}</span>;
  const total = assets.reduce((s, a) => s + a.currentValue, 0);

  return (
    <div>
      <h1 className="text-2xl font-bold">Assets</h1>
      <p className="mt-1 opacity-70">Total current value: <b>{formatINR(total)}</b></p>

      <form onSubmit={save} className="mt-6 grid grid-cols-2 gap-3 rounded border border-stone-300 bg-white p-4 md:grid-cols-4">
        <label className="text-sm">Name<input required value={form.name} onChange={set('name')} className={input} />{err('name')}</label>
        <label className="text-sm">Type
          <select value={form.assetType} onChange={set('assetType')} className={input}>
            {ASSET_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
          </select>
        </label>
        <label className="text-sm">Liquidity
          <select value={form.liquidity} onChange={set('liquidity')} className={input}>
            <option value="">Default for type</option><option value="liquid">Liquid</option><option value="illiquid">Illiquid</option>
          </select>
        </label>
        <label className="text-sm">Purchase value (₹)<input required type="number" step="0.01" value={form.purchaseValue} onChange={set('purchaseValue')} className={input} />{err('purchaseValue')}</label>
        <label className="text-sm">Current value (₹)<input required type="number" step="0.01" value={form.currentValue} onChange={set('currentValue')} className={input} />{err('currentValue')}</label>
        <label className="text-sm">Purchase date<input required type="date" value={form.purchaseDate} onChange={set('purchaseDate')} className={input} />{err('purchaseDate')}</label>
        <label className="text-sm">Valuation date<input type="date" value={form.valuationDate} onChange={set('valuationDate')} className={input} />{err('valuationDate')}</label>
        <label className="text-sm">Notes<input value={form.notes} onChange={set('notes')} className={input} /></label>
        <div className="col-span-2 flex items-end gap-2 md:col-span-4">
          <button className="rounded bg-amber-700 px-4 py-2 text-white">{editingId ? 'Save changes' : 'Add asset'}</button>
          {editingId && <button type="button" onClick={() => { setEditingId(null); setForm(EMPTY); }} className="underline">Cancel</button>}
          {error && <span className="text-sm text-red-700">{error}</span>}
        </div>
      </form>

      <table className="mt-6 w-full border-collapse bg-white text-sm">
        <thead>
          <tr className="border-b text-left">
            <th className="p-2">Name</th><th className="p-2">Type</th><th className="p-2">Liquidity</th>
            <th className="p-2 text-right">Purchase</th><th className="p-2 text-right">Current</th><th className="p-2">Valued on</th><th className="p-2"></th>
          </tr>
        </thead>
        <tbody>
          {assets.map((a) => (
            <tr key={a.id} className="border-b">
              <td className="p-2">{a.name}</td><td className="p-2">{label(a.assetType)}</td><td className="p-2">{a.liquidity}</td>
              <td className="p-2 text-right tabular-nums">{formatINR(a.purchaseValue)}</td>
              <td className="p-2 text-right tabular-nums">{formatINR(a.currentValue)}</td>
              <td className="p-2">{a.valuationDate}</td>
              <td className="p-2 text-right"><button onClick={() => edit(a)} className="underline">Edit</button>{' '}
                <button onClick={() => remove(a.id)} className="text-red-700 underline">Delete</button></td>
            </tr>
          ))}
          {assets.length === 0 && <tr><td colSpan={7} className="p-4 text-center opacity-60">No assets yet – add one above.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
