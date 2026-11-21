import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { hasPermissionPage } from '@/lib/auth/page-guards';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { ReturnsManagementPageClient } from '@/components/returns/ReturnsManagementPageClient';

/**
 * Management returns ledger. Requires the same history permission as the Sales
 * ledger; cashiers process returns from the POS terminal, not this page
 * (ARGUS #100).
 */
export default async function ReturnsManagementPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  if (!hasPermissionPage(session.user, PERMISSIONS.SALE.viewSaleHistory)) {
    redirect('/dashboard');
  }

  return <ReturnsManagementPageClient />;
}
