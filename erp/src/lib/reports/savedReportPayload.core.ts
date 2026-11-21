/**
 * Saved-report UI request builder (ARGUS #450).
 *
 * The Save Report dialog used to assemble its POST body inline. That let the
 * UI send a `/reports/<slug>` path long after the API had moved to slugs
 * (ARGUS #444), which the API-only suite could not catch. The builder is pure
 * so the exact payload can be tested.
 */
import { normalizeReportType } from '@/lib/reports/report-config';
import {
  SAVED_REPORT_NAME_MAX_LENGTH,
  validateSavedReportName,
} from '@/lib/reports/savedReportValidation.core';

export type SavedReportFormat = 'pdf' | 'csv' | 'xlsx';

export interface SavedReportRequestInput {
  /** Name typed in the Save Report dialog. */
  name: string;
  /** Route path or already-canonical slug. */
  reportType: string;
  filters: Record<string, unknown>;
  format: SavedReportFormat;
  rows: ReadonlyArray<Record<string, unknown>>;
  columns: ReadonlyArray<{ key: string; header: string; width?: number }>;
  title: string;
  dateRange: string;
}

export interface SavedReportRequestPayload {
  name: string;
  reportType: string;
  filters: Record<string, unknown>;
  format: SavedReportFormat;
  rows: Record<string, unknown>[];
  columns: Array<{ key: string; header: string; width?: number }>;
  title: string;
  dateRange: string;
}

export type SavedReportRequestResult =
  | { ok: true; payload: SavedReportRequestPayload }
  | { ok: false; reason: 'invalid-report-type' | 'invalid-name'; message: string };

/** Build the exact POST /api/reports/saved body the UI sends. */
export function buildSavedReportRequest(
  input: SavedReportRequestInput,
): SavedReportRequestResult {
  const reportType = normalizeReportType(input.reportType);
  if (!reportType) {
    return {
      ok: false,
      reason: 'invalid-report-type',
      message: 'This page is not a savable report',
    };
  }

  const name = validateSavedReportName(input.name);
  if (!name.ok) {
    return { ok: false, reason: 'invalid-name', message: name.message ?? 'Invalid name' };
  }

  return {
    ok: true,
    payload: {
      name: name.name.slice(0, SAVED_REPORT_NAME_MAX_LENGTH),
      reportType,
      filters: input.filters,
      format: input.format,
      rows: [...input.rows],
      columns: input.columns.map((column) =>
        column.width === undefined
          ? { key: column.key, header: column.header }
          : { key: column.key, header: column.header, width: column.width },
      ),
      title: input.title,
      dateRange: input.dateRange,
    },
  };
}
