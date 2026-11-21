import { PERMISSIONS } from '@/lib/constants/permissions';
import { hasPermission } from '@/lib/utils/permissions';

type CommissionReportUser = Parameters<typeof hasPermission>[0];

/**
 * The commission report page must use the same permission rule as the APIs it
 * calls (ARGUS #364): staff view OR staff manage. Cashiers hold neither, so
 * the server page redirects them instead of rendering a zero-value report.
 */
export function canViewCommissionReports(
  user: CommissionReportUser | null | undefined,
): boolean {
  return (
    hasPermission(user, PERMISSIONS.STAFF.viewStaff) ||
    hasPermission(user, PERMISSIONS.STAFF.manageStaff)
  );
}
