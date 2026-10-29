'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';

interface Note { id: number; kind: string; title: string; body: string; isRead: boolean; loanId: number }

/** Bell with unread count and a drop-down list of EMI reminders (FR-24). */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ unread: number; notifications: Note[] }>({ unread: 0, notifications: [] });
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/notifications');
    if (res.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    const close = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('click', close);
    return () => { clearInterval(t); document.removeEventListener('click', close); };
  }, [load]);

  async function read(body: { id: number } | { all: true }) {
    await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    load();
  }

  return (
    <div ref={box} className="relative">
      <button onClick={() => setOpen(!open)} aria-label={`Notifications, ${data.unread} unread`} aria-expanded={open} className="relative text-lg leading-none">
        🔔{data.unread > 0 && <span className="absolute -right-2 -top-1 rounded-full bg-red-700 px-1 text-[10px] text-white">{data.unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded border border-stone-300 bg-white p-2 text-sm shadow-lg">
          <div className="flex items-center px-1 pb-1">
            <b>Reminders</b>
            {data.unread > 0 && <button onClick={() => read({ all: true })} className="ml-auto text-xs underline">Mark all read</button>}
          </div>
          <ul className="max-h-80 overflow-auto">
            {data.notifications.map((n) => (
              <li key={n.id} className={`border-t px-1 py-1.5 ${n.isRead ? 'opacity-60' : ''}`}>
                <div className={n.kind === 'overdue' ? 'font-semibold text-red-700' : 'font-medium'}>{n.title}</div>
                <div className="text-xs">{n.body}</div>
                <div className="mt-0.5 flex gap-3 text-xs">
                  <Link href={`/loans/${n.loanId}`} onClick={() => setOpen(false)} className="underline">Open loan</Link>
                  {!n.isRead && <button onClick={() => read({ id: n.id })} className="underline">Mark read</button>}
                </div>
              </li>
            ))}
            {data.notifications.length === 0 && <li className="px-1 py-2 opacity-60">No reminders.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}
