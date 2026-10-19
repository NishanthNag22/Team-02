import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WealthWise',
  description: 'Wealth management for Indian households',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
