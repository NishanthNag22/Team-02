'use client';

import { useState } from 'react';
import { formatINR } from '@/lib/format';

interface Scan { merchant: string | null; amount: number | null; date: string | null; confidence: number; suggestedCategory: string; text: string }

/** Receipt scanning: photo → OCR → check the fields → save as an expense (FR-16). */
export default function ReceiptsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [scan, setScan] = useState<Scan | null>(null);
  const [form, setForm] = useState({ merchant: '', amount: '', date: '', category: '', saveToVault: true });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function choose(f: File | null) {
    setFile(f); setScan(null); setMessage(null);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function read(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true); setMessage(null);
    const body = new FormData();
    body.append('file', file);
    const res = await fetch('/api/receipts/scan', { method: 'POST', body });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) { setMessage(data.error); return; }
    setScan(data);
    setForm({
      merchant: data.merchant ?? '', amount: data.amount != null ? String(data.amount) : '',
      date: data.date ?? new Date().toISOString().slice(0, 10), category: data.suggestedCategory, saveToVault: true,
    });
  }

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const body = new FormData();
    Object.entries(form).forEach(([k, v]) => body.append(k, String(v)));
    if (form.saveToVault && file) body.append('file', file);
    const res = await fetch('/api/receipts/confirm', { method: 'POST', body });
    const data = await res.json();
    setBusy(false);
    if (res.ok) {
      setMessage(`Saved ${formatINR(Number(form.amount))} at ${form.merchant} as an expense.${data.vault.saved ? ' Image filed in the vault.' : data.vault.message ? ` ${data.vault.message}` : ''}`);
      setScan(null); choose(null);
    } else setMessage(data.fields ? Object.values(data.fields).flat().join(' ') : data.error);
  }

  const input = 'w-full rounded border border-stone-300 bg-white px-2 py-1';
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Scan a receipt</h1>
      <form onSubmit={read} className="flex flex-wrap items-center gap-2 rounded border border-stone-300 bg-white p-4 text-sm">
        <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" aria-label="Receipt photo" onChange={(e) => choose(e.target.files?.[0] ?? null)} />
        <button disabled={!file || busy} className="rounded bg-amber-700 px-3 py-1 text-white disabled:opacity-50">{busy && !scan ? 'Reading… (a few seconds)' : 'Read receipt'}</button>
        <span className="text-xs opacity-60">JPEG, PNG or WebP, max 8 MB. Nothing is saved until you confirm.</span>
      </form>
      {message && <p role="status" className="text-sm">{message}</p>}

      {scan && (
        <div className="grid gap-4 md:grid-cols-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {preview && <img src={preview} alt="Uploaded receipt" className="max-h-96 rounded border border-stone-300 object-contain" />}
          <form onSubmit={confirm} className="space-y-2 rounded border border-stone-300 bg-white p-4 text-sm">
            <p className="text-xs opacity-70">Read with {scan.confidence}% confidence – please check before saving.</p>
            <label className="block">Merchant<input required value={form.merchant} onChange={(e) => setForm({ ...form, merchant: e.target.value })} className={input} /></label>
            <label className="block">Amount ₹<input required type="number" step="0.01" min="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className={input} /></label>
            <label className="block">Date<input required type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={input} /></label>
            <label className="block">Category<input required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={input} /></label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.saveToVault} onChange={(e) => setForm({ ...form, saveToVault: e.target.checked })} /> Also file the photo in my vault</label>
            <div className="flex gap-2">
              <button disabled={busy} className="rounded bg-amber-700 px-3 py-1 text-white disabled:opacity-50">Save expense</button>
              <button type="button" onClick={() => setScan(null)} className="rounded border px-3 py-1">Cancel</button>
            </div>
            <details><summary className="text-xs">Text read from the image</summary><pre className="whitespace-pre-wrap text-xs">{scan.text}</pre></details>
          </form>
        </div>
      )}
    </div>
  );
}