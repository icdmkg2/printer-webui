import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { isSetupCompleted } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Guard 1: Verify if the system is configured
  if (!isSetupCompleted()) {
    redirect('/setup');
  }

  // Guard 2: Verify if the user session is authenticated
  const cookieStore = await cookies();
  const session = cookieStore.get('printer_session')?.value;

  if (session !== 'authenticated') {
    redirect('/login');
  }

  return <>{children}</>;
}
