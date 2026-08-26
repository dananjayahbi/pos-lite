import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { BatchListClient } from '@/components/batches/BatchListClient';

export const metadata = {
  title: 'Batches & Expiry | AyurPOS',
};

export default async function BatchesPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect('/login');

  if (!hasPermission(session.user, PERMISSIONS.BATCH.viewBatch)) {
    redirect('/dashboard');
  }

  return <BatchListClient />;
}
