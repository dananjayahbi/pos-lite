import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { hasPermissionPage } from '@/lib/auth/page-guards';
import { PERMISSIONS } from '@/lib/constants/permissions';
import SalesManagementPageClient from '@/components/sales/SalesManagementPageClient';

export default async function SalesManagementPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');
  // XC-03: one key replaces the inline owner/manager comparison. This page is
  // the tenant-wide sale HISTORY ledger — a management view. (The detail page
  // below uses the same key so the two cannot disagree about who may look.)
  if (!hasPermissionPage(session.user, PERMISSIONS.SALE.viewSaleHistory)) {
    redirect('/dashboard');
  }

  return <SalesManagementPageClient />;
}
