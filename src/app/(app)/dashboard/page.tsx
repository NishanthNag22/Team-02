import { getCurrentUser } from '@/lib/auth/session';

/** Placeholder – replaced by the real dashboard in FR-18. */
export default async function DashboardPage() {
  const user = await getCurrentUser();
  return (
    <div>
      <h1 className="text-2xl font-bold">Welcome, {user?.name}</h1>
      <p className="mt-2 opacity-70">Your dashboard is coming in FR-18. Use the menu to manage assets, loans and transactions.</p>
    </div>
  );
}
