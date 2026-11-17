import AppLayout from '@/components/layout/AppLayout';
import { isCurrentDeviceTrusted, getActiveSession } from '@/lib/auth/session';
import { cookies } from 'next/headers';
import { User } from '@/lib/types';

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  let isTrusted = false;
  try {
    isTrusted = await isCurrentDeviceTrusted();
  } catch {
    isTrusted = false;
  }

  const session = await getActiveSession();
  const cookieStore = await cookies();
  const isDemo = cookieStore.get('pocketlog_demo_mode')?.value === 'true';

  const isGatedInitial = Boolean(session && !isDemo && !isTrusted);

  const initialUser: User | null = session ? {
    id: session.userId,
    email: session.email,
    role: session.role,
    full_name: session.fullName || 'User',
    currency: session.currency || 'IDR',
    is_trusted_device: isTrusted,
  } : isDemo ? {
    id: 'demo-user-0000-0000-0000-000000000000',
    email: 'guest@pocketlog.app',
    role: 'superadmin',
    full_name: 'Guest Explorer',
    currency: 'IDR',
    is_trusted_device: true,
  } : null;

  return (
    <AppLayout
      initialUser={initialUser}
      initialIsTrusted={isTrusted}
      initialIsGated={isGatedInitial}
    >
      {children}
    </AppLayout>
  );
}
