import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { isSetupCompleted } from '@/lib/db';
import LoginClient from './LoginClient';

export const dynamic = 'force-dynamic';

export default async function LoginPage() {
  // Guard 1: If setup is not done, force wizard configuration
  if (!isSetupCompleted()) {
    redirect('/setup');
  }

  // Guard 2: If already logged in, redirect straight to dashboard
  const cookieStore = await cookies();
  const session = cookieStore.get('printer_session')?.value;
  if (session === 'authenticated') {
    redirect('/');
  }

  return <LoginClient />;
}
