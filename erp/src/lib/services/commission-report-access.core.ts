import { PERMISSIONS } from '@/lib/constants/permissions';
import { hasPermission } from '@/lib/utils/permissions';

type CommissionReportUser = Parameters<typeof hasPermission>[0];

/**
 * ARGUS #368: commission reports reveal every cashier's earned/paid/unpaid
 * totals, so they are payroll data, not staff-directory data. `staff:view` no
 * longer grants access; the API and page both require `payroll:view`.
 */
export function canViewCommissionReports(
  user: CommissionReportUser | null | undefined,
): boolean {
  return hasPermission(user, PERMISSIONS.PAYROLL.viewPayroll);
}
