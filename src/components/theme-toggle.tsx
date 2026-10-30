'use client';

import { useEffect, useState } from 'react';

/** Light/dark switch; the choice is saved in this browser (NFR-05). */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => { setDark(document.documentElement.classList.contains('dark')); }, []);

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle('dark', next);
    try { localStorage.setItem('ww-theme', next ? 'dark' : 'light'); } catch { /* private mode: still switches for this visit */ }
    setDark(next);
  }

  return (
    <button onClick={toggle} aria-label={`Switch to ${dark ? 'light' : 'dark'} theme`}
      className="fixed bottom-4 right-4 rounded-full border border-stone-300 bg-white px-3 py-1.5 text-sm shadow">
      {dark ? '☀ Light' : '☾ Dark'}
    </button>
  );
}
