/**
 * Payroll run status / payment display (ARGUS #385).
 *
 * A `GENERATED` run has not paid anyone. Calling its net amount "Net salaries
 * paid" - or omitting the status from an export - overstates what happened.
 * These helpers keep the label and the export marker aligned with the run
 * status. Payment date and approver come from the PAYROLL_RUN_PAID audit entry
 * because the schema has no paidAt/paidById columns (no migration is allowed).
 */

export type PayrollRunStatusValue = 'DRAFT' | 'GENERATED' | 'PAID' | (string & {});

export interface PayrollRunPaymentInfo {
  /** ISO timestamp from the payment audit entry, or null when unavailable. */
  paidAt: string | null;
  approvedBy: string | null;
  approvedByRole: string | null;
  source: 'not-paid' | 'audit-log' | 'unavailable';
}

export interface PayrollRunStatusDisplay {
  status: PayrollRunStatusValue;
  paid: boolean;
  netLabel: 'Net payable' | 'Net salaries paid';
  statusLabel: string;
  statusDetail: string;
  /** Single-line marker for export headers. */
  exportMarker: string;
}

export function resolveNetLabel(
  status: PayrollRunStatusValue,
): 'Net payable' | 'Net salaries paid' {
  return status === 'PAID' ? 'Net salaries paid' : 'Net payable';
}

export function formatPayrollDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function describePayrollRunStatus(input: {
  status: PayrollRunStatusValue;
  payment?: PayrollRunPaymentInfo | null | undefined;
}): PayrollRunStatusDisplay {
  const status = input.status || 'GENERATED';
  const payment = input.payment ?? null;
  const netLabel = resolveNetLabel(status);

  if (status === 'PAID') {
    const paidOn = formatPayrollDate(payment?.paidAt);
    const approver = payment?.approvedBy?.trim() || null;
    const detailParts: string[] = [];
    detailParts.push(paidOn ? `Paid on ${paidOn}` : 'Payment date not recorded');
    if (approver) detailParts.push(`approved by ${approver}`);
    else if (payment?.approvedByRole) detailParts.push(`approved by ${payment.approvedByRole}`);
    const statusDetail = detailParts.join(' - ');
    return {
      status,
      paid: true,
      netLabel,
      statusLabel: 'Paid',
      statusDetail,
      exportMarker: `PAID - ${statusDetail}`,
    };
  }

  if (status === 'DRAFT') {
    return {
      status,
      paid: false,
      netLabel,
      statusLabel: 'Draft',
      statusDetail: 'Draft run - not generated or paid',
      exportMarker: 'DRAFT - not generated or paid',
    };
  }

  return {
    status,
    paid: false,
    netLabel,
    statusLabel: 'Unpaid',
    statusDetail: 'Generated and unpaid - no payment recorded',
    exportMarker: 'UNPAID - generated, not yet paid (not a payment confirmation)',
  };
}
