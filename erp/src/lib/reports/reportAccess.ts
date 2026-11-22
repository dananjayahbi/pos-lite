import { PERMISSIONS, type PermissionKey } from '@/lib/constants/permissions';

/**
 * Report page/export permissions (ARGUS #438).
 *
 * Report pages were client-only: a direct visitor got the shell, Export and
 * Save even without the API permission. Export is a separate capability -
 * `report:export` - and must be checked on both sides.
 */
export const REPORT_PAGE_PERMISSIONS: Record<string, PermissionKey> = {
  '/reports/profit-loss': PERMISSIONS.REPORT.viewProfitReport,
  '/reports/sales': PERMISSIONS.REPORT.viewSalesReport,
};

export const REPORT_EXPORT_PERMISSION = PERMISSIONS.REPORT.exportReport;

export function reportPagePermission(pathname: string): PermissionKey | null {
  return REPORT_PAGE_PERMISSIONS[pathname] ?? null;
}

export function canViewReportPage(
  pathname: string,
  permissions: Iterable<string>,
): boolean {
  const required = reportPagePermission(pathname);
  if (!required) return false;
  const held = permissions instanceof Set ? permissions : new Set(permissions);
  return held.has(required);
}

export function canExportReports(permissions: Iterable<string>): boolean {
  const held = permissions instanceof Set ? permissions : new Set(permissions);
  return held.has(REPORT_EXPORT_PERMISSION);
}
