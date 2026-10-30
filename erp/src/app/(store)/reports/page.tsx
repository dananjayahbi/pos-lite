import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { denialRouteFor } from '@/lib/auth/page-guards';
import { getEffectivePermissions } from '@/lib/constants/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { ReportsHub } from '@/components/reports/ReportsHub';

export const metadata = { title: 'Reports | AyurPOS' };

export default async function ReportsIndexPage() {
  const session = await auth();
  if (!session?.user?.tenantId) redirect(denialRouteFor(session?.user));

  const permissions = getEffectivePermissions(session.user.role, session.user.permissions);

  // Reports are a management surface; any report key grants the directory.
  const canSeeReports =
    permissions.includes(PERMISSIONS.REPORT.viewSalesReport) ||
    permissions.includes(PERMISSIONS.REPORT.viewProfitReport) ||
    permissions.includes(PERMISSIONS.REPORT.viewStockReport);

  if (!canSeeReports) redirect('/dashboard');

  return <ReportsHub permissions={permissions} />;
}
