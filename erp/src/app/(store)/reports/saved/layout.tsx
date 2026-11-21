import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';

const REPORT_VIEW_PERMISSIONS = [
  PERMISSIONS.REPORT.viewSalesReport,
  PERMISSIONS.REPORT.viewProfitReport,
  PERMISSIONS.REPORT.viewStockReport,
  PERMISSIONS.REPORT.viewCustomerReport,
  PERMISSIONS.REPORT.viewZeroValueReport,
  PERMISSIONS.REPORT.viewRecoveryReport,
] as const;

/**
 * ARGUS #446: the saved-report library is a report surface too. A session with
 * no report permission must not see the page shell and its actions.
 */
export default async function SavedReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  const canViewAny = REPORT_VIEW_PERMISSIONS.some((permission) =>
    hasPermission(session.user, permission),
  );
  if (!canViewAny) redirect('/dashboard');

  return <>{children}</>;
}
