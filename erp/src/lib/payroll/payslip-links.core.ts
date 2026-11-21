/**
 * Payslip action links (ARGUS #380).
 *
 * The API already streams the PDF; the only difference between "Print" and
 * "Download" is the `Content-Disposition`. Keeping the URL construction here
 * means the two buttons cannot silently collapse back into the same action.
 */

export type PayslipAction = 'view' | 'download';

export function payslipUrl(
  runId: string,
  userId: string,
  action: PayslipAction = 'download',
): string {
  const base = `/api/store/payroll/runs/${encodeURIComponent(runId)}/payslips/${encodeURIComponent(userId)}`;
  return action === 'view' ? `${base}?disposition=inline` : base;
}

/** True when the route should render the PDF in the browser instead of saving it. */
export function wantsInlinePayslip(disposition: string | null | undefined): boolean {
  return disposition?.trim().toLowerCase() === 'inline';
}
