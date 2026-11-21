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

export type ManualAdjustmentDirection = 'add' | 'remove';

/**
 * ARGUS #193 — which signed delta a manual reason may carry.
 *
 * Found and Data Error are corrections that can discover or write off stock,
 * so they work in either direction. Damaged, Stolen and Returned to Supplier
 * are losses: they may only remove stock. A positive "Damaged" or a negative
 * "Found" would make the ledger tell a false story.
 */
export const MANUAL_ADJUSTMENT_DIRECTION: Record<
  ManualAdjustmentReason,
  ManualAdjustmentDirection | 'either'
> = {
  FOUND: 'either',
  DATA_ERROR: 'either',
  DAMAGED: 'remove',
  STOLEN: 'remove',
  RETURNED_TO_SUPPLIER: 'remove',
};

const MANUAL_ADJUSTMENT_REASON_SET: ReadonlySet<string> = new Set(
  MANUAL_ADJUSTMENT_REASONS,
);

export function isManualAdjustmentReason(
  reason: string | null | undefined,
): reason is ManualAdjustmentReason {
  return reason != null && MANUAL_ADJUSTMENT_REASON_SET.has(reason);
}

/** True when this signed delta is legal for a manual reason. */
export function isManualReasonDirectionValid(
  reason: string | null | undefined,
  quantityDelta: number,
): boolean {
  if (!isManualAdjustmentReason(reason) || quantityDelta === 0) return false;

  const rule = MANUAL_ADJUSTMENT_DIRECTION[reason];
  if (rule === 'either') return true;
  return rule === 'add' ? quantityDelta > 0 : quantityDelta < 0;
}

/**
 * Human-readable direction error, or `null` when the pair is valid. Unknown
 * reasons return `null` here — the reason allowlist (#181) owns that message.
 */
export function manualAdjustmentDirectionError(
  reason: string | null | undefined,
  quantityDelta: number,
): string | null {
  if (!isManualAdjustmentReason(reason)) return null;
  if (isManualReasonDirectionValid(reason, quantityDelta)) return null;

  if (quantityDelta === 0) return 'quantityDelta cannot be zero';
  return MANUAL_ADJUSTMENT_DIRECTION[reason] === 'add'
    ? `${reason} can only be used when adding stock.`
    : `${reason} can only be used when removing stock.`;
}

/** Reasons selectable for the chosen direction — used by the adjustment UI. */
export function validManualReasonsForDirection(
  direction: ManualAdjustmentDirection,
): readonly ManualAdjustmentReason[] {
  return MANUAL_ADJUSTMENT_REASONS.filter((reason) => {
    const rule = MANUAL_ADJUSTMENT_DIRECTION[reason];
    return rule === 'either' || rule === direction;
  });
}
