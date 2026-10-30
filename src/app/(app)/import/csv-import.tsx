'use client';

import { useCallback, useEffect, useState } from 'react';
import { formatINR } from '@/lib/format';

interface Row { rowNumber: number; txnDate: string; description: string; amount: number; txnType: 'income' | 'expense'; category: string; duplicate: boolean }
interface Rejected { rowNumber: number; reason: string }
interface Batch { id: number; fileName: string; bank: string; rowCount: number; inserted: number; duplicates: number; createdAt: string }

/** Bank statement upload → preview → confirm (FR-14). */
export function CsvImport() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{ fileName: string; bank: string; rows: Row[]; rejected: Rejected[] } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [batches, setBatches] = useState<Batch[]>([]);

  const loadBatches = useCallback(async () => {
    const res = await fetch('/api/imports/batches');
    if (res.ok) setBatches((await res.json()).batches);
  }, []);
  useEffect(() => { loadBatches(); }, [loadBatches]);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true); setMessage(null); setPreview(null);
    const body = new FormData();
    body.append('file', file);
    const res = await fetch('/api/imports/preview', { method: 'POST', body });
    const data = await res.json();
    setBusy(false);
    if (res.ok) setPreview(data); else setMessage(data.error);
  }

  function setCategory(i: number, category: string) {
    if (!preview) return;
    const rows = preview.rows.slice();
    rows[i] = { ...rows[i], category };
    setPreview({ ...preview, rows });
  }

  async function commit() {
    if (!preview) return;
    const rows = preview.rows.filter((r) => !r.duplicate)
      .map(({ txnDate, description, amount, txnType, category }) => ({ txnDate, description, amount, txnType, category }));
    if (rows.length === 0) { setMessage('Every row is already imported.'); return; }
    setBusy(true);
    const res = await fetch('/api/imports/commit', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileName: preview.fileName, bank: preview.bank, rows }),
    });
    const data = await res.json();
    setBusy(false);
    if (res.ok) {
      setMessage(`Imported ${data.inserted} transaction(s); ${data.duplicates} duplicate(s) skipped.`);
      setPreview(null); setFile(null); loadBatches();
    } else setMessage(data.error);
  }

  const fresh = preview?.rows.filter((r) => !r.duplicate).length ?? 0;

  return (
    <section className="rounded border border-stone-300 bg-white p-4">
      <h2 className="font-semibold">Import a bank statement</h2>
      <p className="text-sm opacity-70">CSV from HDFC, ICICI, SBI, Axis or Kotak (max 5 MB). You can check everything before it is saved.</p>
      <form onSubmit={upload} className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <input type="file" accept=".csv,text/csv" aria-label="Statement CSV file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <button disabled={!file || busy} className="rounded bg-amber-700 px-3 py-1 text-white disabled:opacity-50">{busy ? 'Working…' : 'Preview'}</button>
      </form>
      {message && <p role="status" className="mt-2 text-sm">{message}</p>}

      {preview && (
        <div className="mt-4 space-y-2">
          <p className="text-sm"><b>{preview.bank}</b> statement · {preview.rows.length} rows read · {fresh} new · {preview.rows.length - fresh} already imported · {preview.rejected.length} rejected</p>
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left"><th>Date</th><th>Description</th><th className="text-right">Amount</th><th>Category</th><th></th></tr></thead>
              <tbody>
                {preview.rows.map((r, i) => (
                  <tr key={r.rowNumber} className={`border-t ${r.duplicate ? 'opacity-50' : ''}`}>
                    <td>{r.txnDate}</td><td>{r.description}</td>
                    <td className={`text-right ${r.txnType === 'income' ? 'text-green-700' : ''}`}>{r.txnType === 'income' ? '+' : '−'}{formatINR(r.amount)}</td>
                    <td><input value={r.category} disabled={r.duplicate} aria-label={`Category for row ${r.rowNumber}`} onChange={(e) => setCategory(i, e.target.value)} className="w-32 rounded border border-stone-300 px-1" /></td>
                    <td className="text-xs">{r.duplicate ? 'duplicate' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.rejected.length > 0 && (
            <details className="text-sm"><summary>{preview.rejected.length} rejected row(s)</summary>
              <ul>{preview.rejected.map((r) => <li key={r.rowNumber}>Row {r.rowNumber}: {r.reason}</li>)}</ul>
            </details>
          )}
          <div className="flex gap-2">
            <button onClick={commit} disabled={busy || fresh === 0} className="rounded bg-amber-700 px-3 py-1 text-sm text-white disabled:opacity-50">Import {fresh} transaction(s)</button>
            <button onClick={() => setPreview(null)} className="rounded border px-3 py-1 text-sm">Cancel</button>
          </div>
        </div>
      )}

      <h3 className="mt-6 text-sm font-semibold">Import history</h3>
      <ul className="text-sm">
        {batches.map((b) => (
          <li key={b.id}>{new Date(b.createdAt).toLocaleString('en-IN')} – {b.fileName} ({b.bank}): {b.inserted} added, {b.duplicates} duplicate(s)</li>
        ))}
        {batches.length === 0 && <li className="opacity-60">No imports yet.</li>}
      </ul>
    </section>
  );
}
