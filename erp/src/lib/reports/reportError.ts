/**
 * One error-message contract for the report clients (ARGUS #442).
 *
 * The P&L page read the API envelope on a non-2xx response and showed the
 * server's typed message; the Sales page discarded the body and printed a
 * generic "Failed to fetch report". Both now use this resolver so a 403 and a
 * 500 read the same way.
 */

export interface ReportErrorEnvelope {
  success?: boolean;
  error?: { code?: string; message?: string } | null;
}

/**
 * Prefer the server's typed message; fall back to an HTTP status line when the
 * response has no JSON body (proxy error, HTML error page, aborted request).
 */
export function resolveReportErrorMessage(
  status: number,
  body: ReportErrorEnvelope | null | undefined,
): string {
  const typed = body?.error?.message?.trim();
  if (typed) return typed;
  return `Failed to fetch report (HTTP ${status})`;
}
