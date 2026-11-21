/**
 * Raw-material adjustment reasons and audit-history mapping (ARGUS #246).
 *
 * Raw materials have no dedicated movement table (and this task must not add
 * one), so the durable history is the existing `AuditLog` rows written by
 * `adjustRawMaterialStock` with action `RAW_MATERIAL_STOCK_ADJUSTED`. This module
 * owns the fixed reason vocabulary and the pure mapping from an audit row to a
 * display entry.
 */

export const RAW_MATERIAL_ADJUSTMENT_REASONS = [
  'purchase',
  'production',
  'wastage',
  'correction',
  'return',
] as const;

export type RawMaterialAdjustmentReason = (typeof RAW_MATERIAL_ADJUSTMENT_REASONS)[number];

export const RAW_MATERIAL_ADJUSTMENT_REASON_LABELS: Record<
  RawMaterialAdjustmentReason,
  string
> = {
  purchase: 'Purchase',
  production: 'Production',
  wastage: 'Wastage',
  correction: 'Correction',
  return: 'Return',
};

export function isRawMaterialAdjustmentReason(
  value: unknown,
): value is RawMaterialAdjustmentReason {
  return (
    typeof value === 'string' &&
    (RAW_MATERIAL_ADJUSTMENT_REASONS as readonly string[]).includes(value)
  );
}

export interface RawMaterialAdjustmentAuditRow {
  id: string;
  createdAt: Date | string;
  actorName?: string | undefined;
  after: unknown;
}

export interface RawMaterialAdjustmentHistoryItem {
  id: string;
  createdAt: string;
  actorName: string;
  reason: RawMaterialAdjustmentReason | null;
  /** Raw historical reason, including pre-ARGUS free text. */
  reasonText: string | null;
  quantityDelta: string | null;
  quantityBefore: string | null;
  quantityAfter: string | null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

export function mapRawMaterialAdjustmentAudit(
  row: RawMaterialAdjustmentAuditRow,
): RawMaterialAdjustmentHistoryItem {
  const after = asRecord(row.after);
  const reasonText = asString(after?.['reason']);
  const createdAt =
    row.createdAt instanceof Date ? row.createdAt.toISOString() : row.createdAt;

  return {
    id: row.id,
    createdAt,
    actorName: row.actorName ?? 'System',
    reason: isRawMaterialAdjustmentReason(reasonText) ? reasonText : null,
    reasonText,
    quantityDelta: asString(after?.['quantityDelta']),
    quantityBefore: asString(after?.['quantityBefore']),
    quantityAfter: asString(after?.['quantityAfter']),
  };
}
