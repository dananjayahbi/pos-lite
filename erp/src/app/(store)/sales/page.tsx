import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import SalesManagementPageClient from '@/components/sales/SalesManagementPageClient';

export default async function SalesManagementPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'OWNER' && session.user.role !== 'MANAGER') {
    redirect('/dashboard');
  }
  if (!hasPermission(session.user, PERMISSIONS.SALE.viewSale)) {
    redirect('/dashboard');
  }

  return <SalesManagementPageClient />;
}
