import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/session';
import { AppNav } from '@/components/app-nav';
import { ThemeToggle } from '@/components/theme-toggle';

export const dynamic = 'force-dynamic';

/** Every page inside (app)/ requires a signed-in user (FR-04). */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return (
    <div className="min-h-screen">
      <AppNav name={user.name} role={user.role} />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      <ThemeToggle />
    </div>
  );
}
