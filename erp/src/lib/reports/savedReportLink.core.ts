/**
 * Saved-report navigation helpers (ARGUS #450).
 *
 * The href builder was duplicated in the Saved Reports page and the report
 * shell. Extracting it gives legacy/unknown rows one fallback rule and lets the
 * UI coverage test pin that a stored path is never used as an href.
 */
import { buildReportHref, normalizeReportType } from '@/lib/reports/report-config';

export interface SavedReportLinkLike {
  reportType: string;
  filters?: Record<string, unknown> | null;
}

/**
 * Compose an in-app href from a known slug only. Legacy rows that stored a
 * path, an unknown slug or a protocol-relative value return `null` (the UI
 * renders a disabled "Unknown report" action instead of a link).
 */
export function buildSavedReportHref(report: SavedReportLinkLike): string | null {
  const slug = normalizeReportType(report.reportType);
  if (!slug) return null;

  const route = buildReportHref(slug);
  const params = new URLSearchParams();

  Object.entries(report.filters ?? {}).forEach(([key, value]) => {
    if (typeof value === 'string') {
      params.set(key, value);
    } else if (Array.isArray(value)) {
      value.forEach((item) => {
        if (typeof item === 'string') {
          params.append(key, item);
        }
      });
    }
  });

  const query = params.toString();
  return query ? `${route}?${query}` : route;
}

/** Download/view URL for a stored artifact. */
export function savedReportDownloadHref(id: string, inline = false): string {
  const base = `/api/reports/saved/${encodeURIComponent(id)}/download`;
  return inline ? `${base}?view=1` : base;
}
