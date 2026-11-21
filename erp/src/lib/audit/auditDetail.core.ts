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
