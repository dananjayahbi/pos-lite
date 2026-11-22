import { PERMISSIONS, type PermissionKey } from '@/lib/constants/permissions';
import { normalizeReportType } from '@/lib/reports/report-config';

/**
 * Saved-report authorization and snapshot integrity (ARGUS #446).
 *
 * Every saved-report operation used to require only the sales-report key, so a
 * sales-only user could store/read a P&L, stock or customer artifact. The
 * artifact is a client snapshot; it is labelled as such and its columns are
 * checked against the report definition before generation.
 */

export function savedReportPermission(reportType: string | null | undefined): PermissionKey {
  const slug = normalizeReportType(reportType);
  switch (slug) {
    case 'profit-loss':
      return PERMISSIONS.REPORT.viewProfitReport;
    case 'inventory-valuation':
    case 'stock-movements':
      return PERMISSIONS.REPORT.viewStockReport;
    case 'customer-analytics':
      return PERMISSIONS.REPORT.viewCustomerReport;
    case 'zero-value-sales':
      return PERMISSIONS.REPORT.viewZeroValueReport;
    case 'recovery-staff-performance':
      return PERMISSIONS.REPORT.viewRecoveryReport;
    case 'sales':
    case 'revenue-trend':
    case 'return-rate':
    case 'staff-performance':
    case 'sales-by-staff':
      return PERMISSIONS.REPORT.viewSalesReport;
    default:
      return PERMISSIONS.REPORT.viewSalesReport;
  }
}

export const SAVED_REPORT_SNAPSHOT_KEY = '_snapshot';

export function savedReportSnapshotMeta(
  filters: Record<string, unknown> | null | undefined,
): { asOf: string | null; source: string | null } {
  const raw = filters?.[SAVED_REPORT_SNAPSHOT_KEY];
  if (typeof raw !== 'object' || raw === null) return { asOf: null, source: null };
  const record = raw as Record<string, unknown>;
  return {
    asOf: typeof record.asOf === 'string' ? record.asOf : null,
    source: typeof record.source === 'string' ? record.source : null,
  };
}

/**
 * Keep only columns that belong to the report definition. A client cannot
 * smuggle arbitrary columns into the generated artifact; when none match we
 * fall back to the server definition.
 */
export function filterSnapshotColumns<T extends { key: string }>(
  clientColumns: readonly T[],
  serverColumns: readonly { key: string }[],
): T[] {
  const allowed = new Set(serverColumns.map((column) => column.key));
  return clientColumns.filter((column) => allowed.has(column.key));
}
