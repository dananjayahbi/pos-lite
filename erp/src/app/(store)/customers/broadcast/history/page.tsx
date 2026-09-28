import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { BroadcastHistoryClient } from './BroadcastHistoryClient';

// M31-02 (OBS-52): this page used to be a bare `'use client'` component, so a
// CASHIER loaded the shell and only the API's 403 produced an empty/erroring
// UI. It now has a real server-side gate using the same permission as the
// history API and the broadcast composer (client decision D15).
export default async function BroadcastHistoryPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  if (!hasPermission(session.user, PERMISSIONS.BROADCAST.send)) {
    redirect('/dashboard');
  }

  return <BroadcastHistoryClient />;
}