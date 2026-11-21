/**
 * Payroll export audit payload (ARGUS #391).
 *
 * Bank, NIC and EPF/ETF downloads are sensitive. Each successful file build
 * writes a durable audit row identifying who downloaded what, for which run,
 * in which format and when. Pure builder so the payload is unit tested; the
 * route uses `writeAuditLog` (the non-swallowing writer).
 */

export type PayrollExportAuditType = 'bank-sheet' | 'statutory' | 'summary';
export type PayrollExportAuditFormat = 'xlsx' | 'pdf';

export interface PayrollExportAuditInput {
  exportType: PayrollExportAuditType;
  format: PayrollExportAuditFormat;
  periodMonth: string;
  itemCount: number;
  /** True when the caller explicitly downloaded a flagged incomplete file. */
  incompleteOverride?: boolean | undefined;
}

export interface PayrollExportAuditPayload {
  exportType: PayrollExportAuditType;
  format: PayrollExportAuditFormat;
  periodMonth: string;
  itemCount: number;
  incompleteOverride: boolean;
}

export function buildPayrollExportAudit(
  input: PayrollExportAuditInput,
): PayrollExportAuditPayload {
  return {
    exportType: input.exportType,
    format: input.format,
    periodMonth: input.periodMonth,
    itemCount: Number.isFinite(input.itemCount)
      ? Math.max(0, Math.trunc(input.itemCount))
      : 0,
    incompleteOverride: input.incompleteOverride === true,
  };
}
