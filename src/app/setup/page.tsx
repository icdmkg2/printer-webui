import { redirect } from 'next/navigation';
import { isSetupCompleted } from '@/lib/db';
import SetupClient from './SetupClient';

export default async function SetupPage() {
  if (isSetupCompleted()) {
    redirect('/');
  }

  return <SetupClient />;
}
