import type { StockMovementReason } from '@/generated/prisma/client';

/**
 * ARGUS #181 — reasons a human may choose for a manual stock adjustment.
 *
 * The movement enum also contains system-only reasons written by sales,
 * purchases, returns, opening stock and stock takes. Those flows own their
 * movement rows; letting an operator pick them from the manual adjustment
 * dialog would forge an audit trail and distort reconciliation. This tuple is
 * the single source of truth for the UI, the adjust APIs and the service audit
 * allowlist.
 */
export const MANUAL_ADJUSTMENT_REASONS = [
  'FOUND',
  'DAMAGED',
  'STOLEN',
  'DATA_ERROR',
  'RETURNED_TO_SUPPLIER',
] as const satisfies readonly StockMovementReason[];

export type ManualAdjustmentReason = (typeof MANUAL_ADJUSTMENT_REASONS)[number];

const MANUAL_ADJUSTMENT_REASON_SET: ReadonlySet<string> = new Set(
  MANUAL_ADJUSTMENT_REASONS,
);

export function isManualAdjustmentReason(
  reason: string | null | undefined,
): reason is ManualAdjustmentReason {
  return reason != null && MANUAL_ADJUSTMENT_REASON_SET.has(reason);
}
