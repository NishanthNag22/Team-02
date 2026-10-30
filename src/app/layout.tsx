import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WealthWise',
  description: 'Wealth management for Indian households',
};

/**
 * Runs before the page is painted, so a dark-theme user never sees a white flash (NFR-05).
 * Uses the saved choice, otherwise the operating-system setting.
 */
const THEME_SCRIPT = `try{var t=localStorage.getItem('ww-theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
