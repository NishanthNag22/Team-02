import { formatINR } from '@/lib/format';

export default function HomePage() {
  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-3xl font-bold">WealthWise</h1>
      <p className="mt-2 text-lg">Net worth, loans and expenses in one place.</p>
      <p className="mt-6 text-sm opacity-70">
        Project setup complete. Example amount: {formatINR(9200000)}
      </p>
      <p className="mt-2 text-sm opacity-70">
        Database check: <a className="underline" href="/api/health">/api/health</a>
      </p>
    </main>
  );
}
