'use client';

import { useCallback, useEffect, useState } from 'react';

interface Doc { id: number; title: string; fileName: string; mimeType: string; sizeBytes: number; tags: string[]; loanId: number | null; assetId: number | null; createdAt: string }
interface Listing { documents: Doc[]; stats: { count: number; totalBytes: number; byTag: Record<string, number> } }
interface Option { id: number; label: string }

const size = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** Document vault (FR-17). */
export default function VaultPage() {
  const [data, setData] = useState<Listing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState({ q: '', tag: '' });
  const [form, setForm] = useState({ title: '', tags: '', loanId: '', assetId: '' });
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loans, setLoans] = useState<Option[]>([]);
  const [assets, setAssets] = useState<Option[]>([]);

  const load = useCallback(async (f: { q: string; tag: string }) => {
    const res = await fetch(`/api/vault?${new URLSearchParams(Object.entries(f).filter(([, v]) => v))}`);
    const body = await res.json();
    if (res.ok) { setData(body); setError(null); } else setError(body.error);
  }, []);

  useEffect(() => {
    load({ q: '', tag: '' });
    fetch('/api/loans').then(async (r) => r.ok && setLoans((await r.json()).loans.map((l: { id: number; lender: string; loanType: string }) => ({ id: l.id, label: `${l.lender} (${l.loanType})` }))));
    fetch('/api/assets').then(async (r) => r.ok && setAssets((await r.json()).assets.map((a: { id: number; name: string }) => ({ id: a.id, label: a.name }))));
  }, [load]);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    const body = new FormData();
    body.append('file', file);
    Object.entries(form).forEach(([k, v]) => body.append(k, v));
    const res = await fetch('/api/vault', { method: 'POST', body });
    const out = await res.json();
    if (res.ok) {
      setMessage(`Saved “${out.document.title}”.`);
      setForm({ title: '', tags: '', loanId: '', assetId: '' }); setFile(null);
      (e.target as HTMLFormElement).reset();
      load(filter);
    } else setMessage(out.fields ? Object.values(out.fields).flat().join(' ') : out.error);
  }

  async function remove(d: Doc) {
    if (!window.confirm(`Delete “${d.title}”?`)) return;
    await fetch(`/api/vault/${d.id}`, { method: 'DELETE' });
    load(filter);
  }

  const input = 'rounded border border-stone-300 bg-white px-2 py-1';
  const linkName = (d: Doc) => (d.loanId ? loans.find((l) => l.id === d.loanId)?.label : d.assetId ? assets.find((a) => a.id === d.assetId)?.label : null);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Document vault</h1>

      <form onSubmit={upload} className="grid gap-2 rounded border border-stone-300 bg-white p-4 text-sm md:grid-cols-3">
        <label className="md:col-span-3">File (PDF, JPEG, PNG or WebP, max 10 MB)
          <input required type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block" /></label>
        <label>Title<input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className={`${input} w-full`} /></label>
        <label>Tags (comma separated)<input value={form.tags} placeholder="loan papers, sbi" onChange={(e) => setForm({ ...form, tags: e.target.value })} className={`${input} w-full`} /></label>
        <div className="flex gap-2">
          <label className="flex-1">Loan<select value={form.loanId} onChange={(e) => setForm({ ...form, loanId: e.target.value, assetId: '' })} className={`${input} w-full`}>
            <option value="">—</option>{loans.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}</select></label>
          <label className="flex-1">Asset<select value={form.assetId} onChange={(e) => setForm({ ...form, assetId: e.target.value, loanId: '' })} className={`${input} w-full`}>
            <option value="">—</option>{assets.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select></label>
        </div>
        <div className="md:col-span-3"><button className="rounded bg-amber-700 px-3 py-1 text-white">Upload</button> {message && <span role="status">{message}</span>}</div>
      </form>

      <form onSubmit={(e) => { e.preventDefault(); load(filter); }} className="flex flex-wrap gap-2 text-sm">
        <input placeholder="Search title or file name" aria-label="Search documents" value={filter.q} onChange={(e) => setFilter({ ...filter, q: e.target.value })} className={input} />
        <select aria-label="Filter by tag" value={filter.tag} onChange={(e) => { const f = { ...filter, tag: e.target.value }; setFilter(f); load(f); }} className={input}>
          <option value="">All tags</option>
          {data && Object.keys(data.stats.byTag).sort().map((t) => <option key={t} value={t}>{t} ({data.stats.byTag[t]})</option>)}
        </select>
        <button className="rounded border px-3 py-1">Search</button>
      </form>

      {error && <p role="alert" className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {data && (
        <section className="rounded border border-stone-300 bg-white p-4 text-sm">
          <p className="opacity-70">{data.stats.count} document(s) · {size(data.stats.totalBytes)}</p>
          <ul className="mt-2 divide-y">
            {data.documents.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-2 py-2">
                <a href={`/api/vault/${d.id}/file`} target="_blank" rel="noreferrer" className="font-medium underline">{d.title}</a>
                <span className="text-xs opacity-60">{d.fileName} · {size(d.sizeBytes)} · {new Date(d.createdAt).toLocaleDateString('en-IN')}</span>
                {linkName(d) && <span className="text-xs">🔗 {linkName(d)}</span>}
                {d.tags.map((t) => <span key={t} className="rounded bg-stone-200 px-1.5 text-xs">{t}</span>)}
                <span className="ml-auto flex gap-3">
                  <a href={`/api/vault/${d.id}/file?download=1`} className="underline">Download</a>
                  <button onClick={() => remove(d)} className="text-red-700 underline">Delete</button>
                </span>
              </li>
            ))}
            {data.documents.length === 0 && <li className="py-2 opacity-60">No documents found.</li>}
          </ul>
        </section>
      )}
    </div>
  );
}