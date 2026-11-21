/**
 * Audit detail presentation (ARGUS #454).
 *
 * Deletion rows carry `before` with no `after`; they used to show "No detail
 * data recorded." because the modal only handled both-sides and after-only.
 */
export type AuditDetailMode = 'diff' | 'created' | 'deleted' | 'none';

export function auditDetailMode(
  before: Record<string, unknown> | null | undefined,
  after: Record<string, unknown> | null | undefined,
): AuditDetailMode {
  const hasBefore = !!before && Object.keys(before).length > 0;
  const hasAfter = !!after && Object.keys(after).length > 0;
  if (hasBefore && hasAfter) return 'diff';
  if (hasAfter) return 'created';
  if (hasBefore) return 'deleted';
  return 'none';
}

export interface AuditSnapshotRow {
  field: string;
  value: string;
}

function snapshotValue(value: unknown): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * Rows for a created or deleted snapshot. Keeps the before-only path (a
 * deletion row) rendering its recorded values instead of the "no detail"
 * message (ARGUS #454/#458).
 */
export function auditSnapshotRows(
  snapshot: Record<string, unknown> | null | undefined,
): AuditSnapshotRow[] {
  if (!snapshot) return [];
  return Object.entries(snapshot)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([field, value]) => ({ field, value: snapshotValue(value) }));
}
