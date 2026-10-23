'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatINR } from '@/lib/format';

interface Loan {
  id: number; loanType: string; lender: string; principal: number; interestRate: number; interestType: string;
  tenureMonths: number; startDate: string; status: string; emiAmount: number; paidCount: number; outstanding: number; nextDueDate: string | null;
}
interface Row {
  id: number; installmentNo: number; dueDate: string; emiAmount: number; principalComponent: number;
  interestComponent: number; closingBalance: number; status: string; paidDate: string | null;
}

export default function LoanDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [loan, setLoan] = useState<Loan | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/loans/${params.id}/schedule`);
    if (!res.ok) { setNotFound(true); return; }
    const data = await res.json();
    setLoan(data.loan); setRows(data.schedule);
  }, [params.id]);
  useEffect(() => { load(); }, [load]);

  async function pay(row: Row) {
    setMessage(null);
    const res = await fetch(`/api/emi/${row.id}/pay`, { method: 'POST' });
    const data = await res.json();
    setMessage(res.ok ? `EMI #${row.installmentNo} paid${data.loanClosed ? ' – loan closed 🎉' : ''}.` : data.error);
    load();
  }

  async function setStatus(status: string) {
    await fetch(`/api/loans/${params.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    load();
  }

  async function remove() {
    if (!window.confirm('Delete this loan and its whole schedule?')) return;
    await fetch(`/api/loans/${params.id}`, { method: 'DELETE' });
    router.push('/loans');
  }

  if (notFound) return <p>Loan not found. <Link className="underline" href="/loans">Back to loans</Link></p>;
  if (!loan) return <p>Loading…</p>;

  const nextUnpaid = rows.find((r) => r.status !== 'paid');
  const principalRepaid = loan.principal - loan.outstanding;
  const pct = Math.round((principalRepaid / loan.principal) * 1000) / 10;

  return (
    <div>
      <Link href="/loans" className="text-sm underline">← All loans</Link>
      <h1 className="mt-2 text-2xl font-bold">{loan.lender} – {loan.loanType.replace('_', ' ')} loan</h1>
      <p className="opacity-70">{formatINR(loan.principal)} at {loan.interestRate}% ({loan.interestType}) for {loan.tenureMonths} months · status <b>{loan.status}</b></p>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded border border-stone-300 bg-white p-3"><div className="text-xs opacity-60">EMI</div><div className="text-lg font-semibold tabular-nums">{formatINR(loan.emiAmount)}</div></div>
        <div className="rounded border border-stone-300 bg-white p-3"><div className="text-xs opacity-60">Outstanding</div><div className="text-lg font-semibold tabular-nums">{formatINR(loan.outstanding)}</div></div>
        <div className="rounded border border-stone-300 bg-white p-3"><div className="text-xs opacity-60">Installments paid</div><div className="text-lg font-semibold">{loan.paidCount} / {rows.length}</div></div>
        <div className="rounded border border-stone-300 bg-white p-3"><div className="text-xs opacity-60">Principal repaid</div><div className="text-lg font-semibold">{pct}%</div>
          <div className="mt-1 h-2 rounded bg-stone-200"><div className="h-2 rounded bg-green-700" style={{ width: `${pct}%` }} /></div></div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
        {nextUnpaid && loan.status === 'active' && (
          <button onClick={() => pay(nextUnpaid)} className="rounded bg-amber-700 px-4 py-2 text-white">
            Mark EMI #{nextUnpaid.installmentNo} paid ({formatINR(nextUnpaid.emiAmount)})
          </button>
        )}
        <label>Status{' '}
          <select value={loan.status} onChange={(e) => setStatus(e.target.value)} className="rounded border border-stone-300 bg-white px-2 py-1">
            <option value="active">active</option><option value="closed">closed</option><option value="defaulted">defaulted</option>
          </select>
        </label>
        <button onClick={remove} className="text-red-700 underline">Delete loan</button>
        {message && <span>{message}</span>}
      </div>

      <table className="mt-6 w-full border-collapse bg-white text-sm">
        <thead><tr className="border-b text-left"><th className="p-2">#</th><th className="p-2">Due date</th><th className="p-2 text-right">EMI</th><th className="p-2 text-right">Principal</th><th className="p-2 text-right">Interest</th><th className="p-2 text-right">Balance</th><th className="p-2">Status</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className={`border-b ${r.status === 'paid' ? 'opacity-50' : ''}`}>
              <td className="p-2">{r.installmentNo}</td><td className="p-2">{r.dueDate}</td>
              <td className="p-2 text-right tabular-nums">{formatINR(r.emiAmount)}</td>
              <td className="p-2 text-right tabular-nums">{formatINR(r.principalComponent)}</td>
              <td className="p-2 text-right tabular-nums">{formatINR(r.interestComponent)}</td>
              <td className="p-2 text-right tabular-nums">{formatINR(r.closingBalance)}</td>
              <td className={`p-2 ${r.status === 'overdue' ? 'font-semibold text-red-700' : ''}`}>{r.status}{r.paidDate ? ` (${r.paidDate})` : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
