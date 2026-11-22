/**
 * ARGUS #183 - the single source of truth for the StockMovementReason enum.
 *
 * The Prisma enum is wider than the list the Movement History page used to
 * know about: MANUFACTURED and WEBSITE_ORDER were added by later flows but had
 * no chip, label or CSV translation. Keeping the full enum here means the
 * filter chips, table badges, dashboard cards and CSV export cannot drift from
 * `prisma/schema.prisma`.
 */

export const STOCK_MOVEMENT_REASONS = [
  'FOUND',
  'DAMAGED',
  'STOLEN',
  'DATA_ERROR',
  'RETURNED_TO_SUPPLIER',
  'INITIAL_STOCK',
  'SALE_RETURN',
  'PURCHASE_RECEIVED',
  'STOCK_TAKE_ADJUSTMENT',
  'SALE',
  'VOID_REVERSAL',
  'MANUFACTURED',
  'WEBSITE_ORDER',
] as const;

export type StockMovementReasonValue = (typeof STOCK_MOVEMENT_REASONS)[number];

export const STOCK_MOVEMENT_REASON: Record<
  StockMovementReasonValue,
  StockMovementReasonValue
> = {
  FOUND: 'FOUND',
  DAMAGED: 'DAMAGED',
  STOLEN: 'STOLEN',
  DATA_ERROR: 'DATA_ERROR',
  RETURNED_TO_SUPPLIER: 'RETURNED_TO_SUPPLIER',
  INITIAL_STOCK: 'INITIAL_STOCK',
  SALE_RETURN: 'SALE_RETURN',
  PURCHASE_RECEIVED: 'PURCHASE_RECEIVED',
  STOCK_TAKE_ADJUSTMENT: 'STOCK_TAKE_ADJUSTMENT',
  SALE: 'SALE',
  VOID_REVERSAL: 'VOID_REVERSAL',
  MANUFACTURED: 'MANUFACTURED',
  WEBSITE_ORDER: 'WEBSITE_ORDER',
};

/** Human-readable labels for chips, table badges and the CSV "Reason Label". */
export const STOCK_MOVEMENT_REASON_LABELS: Record<StockMovementReasonValue, string> = {
  FOUND: 'Found',
  DAMAGED: 'Damaged',
  STOLEN: 'Stolen or Lost',
  DATA_ERROR: 'Data Entry Correction',
  RETURNED_TO_SUPPLIER: 'Returned to Supplier',
  INITIAL_STOCK: 'Initial Stock Entry',
  SALE_RETURN: 'Customer Return',
  PURCHASE_RECEIVED: 'Received from Purchase',
  STOCK_TAKE_ADJUSTMENT: 'Stock Take Adjustment',
  SALE: 'Sale',
  VOID_REVERSAL: 'Void Reversal',
  MANUFACTURED: 'Manufactured',
  WEBSITE_ORDER: 'Website Order',
};

export type StockMovementBadgeVariant = 'success' | 'destructive' | 'info' | 'warning';

export const STOCK_MOVEMENT_REASON_BADGE_VARIANT: Record<
  StockMovementReasonValue,
  StockMovementBadgeVariant
> = {
  FOUND: 'success',
  INITIAL_STOCK: 'success',
  PURCHASE_RECEIVED: 'success',
  MANUFACTURED: 'success',
  DAMAGED: 'destructive',
  STOLEN: 'destructive',
  DATA_ERROR: 'info',
  STOCK_TAKE_ADJUSTMENT: 'info',
  SALE: 'info',
  WEBSITE_ORDER: 'info',
  RETURNED_TO_SUPPLIER: 'warning',
  SALE_RETURN: 'warning',
  VOID_REVERSAL: 'warning',
};

export const STOCK_MOVEMENT_REASON_DOT_COLOR: Record<StockMovementReasonValue, string> = {
  FOUND: 'bg-green-500',
  INITIAL_STOCK: 'bg-green-500',
  PURCHASE_RECEIVED: 'bg-green-500',
  MANUFACTURED: 'bg-green-500',
  DAMAGED: 'bg-red-500',
  STOLEN: 'bg-red-500',
  DATA_ERROR: 'bg-blue-500',
  STOCK_TAKE_ADJUSTMENT: 'bg-blue-500',
  SALE: 'bg-blue-400',
  WEBSITE_ORDER: 'bg-blue-400',
  RETURNED_TO_SUPPLIER: 'bg-amber-500',
  SALE_RETURN: 'bg-amber-500',
  VOID_REVERSAL: 'bg-amber-400',
};

const STOCK_MOVEMENT_REASON_SET: ReadonlySet<string> = new Set(STOCK_MOVEMENT_REASONS);

export function isStockMovementReason(
  reason: string | null | undefined,
): reason is StockMovementReasonValue {
  return reason != null && STOCK_MOVEMENT_REASON_SET.has(reason);
}

/**
 * Label lookup that never leaks a raw enum token into the UI or CSV. Unknown
 * values fall back to the supplied text (the raw value) so data written by a
 * future enum member is still readable.
 */
export function stockMovementReasonLabel(reason: string | null | undefined): string {
  if (reason == null) return '';
  return isStockMovementReason(reason) ? STOCK_MOVEMENT_REASON_LABELS[reason] : reason;
}

/**
 * ARGUS #183 - parse the Movement History `reasons` query param.
 *
 * Missing/empty means "all reasons" (the feed's default). Unknown tokens are
 * ignored rather than narrowing the feed silently. The result is always in
 * canonical enum order, so chips and the API see a stable set.
 */
export function parseStockMovementReasons(
  param: string | null | undefined,
): StockMovementReasonValue[] {
  if (param == null) return [...STOCK_MOVEMENT_REASONS];

  const requested = new Set(param.split(',').map((value) => value.trim()).filter(Boolean));
  if (requested.size === 0) return [...STOCK_MOVEMENT_REASONS];

  return STOCK_MOVEMENT_REASONS.filter((reason) => requested.has(reason));
}

/**
 * Serialize a selection back to the `reasons` query param. `null` means "no
 * filter" (all reasons), which keeps the URL clean and lets the API serve its
 * default feed. An empty selection is normalized to "all" because an empty
 * `reasons=` value already has that meaning server-side.
 */
export function serializeStockMovementReasons(
  selected: Iterable<string>,
): string | null {
  const chosen = new Set(selected);
  const ordered = STOCK_MOVEMENT_REASONS.filter((reason) => chosen.has(reason));
  if (ordered.length === 0 || ordered.length === STOCK_MOVEMENT_REASONS.length) {
    return null;
  }
  return ordered.join(',');
}

/**
 * Toggle one reason chip. The first toggle from the default (no param) starts
 * from the full 13-reason set, so re-serializing cannot drop a reason the old
 * 11-entry chip list did not know about.
 */
export function toggleStockMovementReason(
  param: string | null | undefined,
  reason: StockMovementReasonValue,
): string | null {
  const selected = new Set(parseStockMovementReasons(param));
  if (selected.has(reason)) {
    selected.delete(reason);
  } else {
    selected.add(reason);
  }
  return serializeStockMovementReasons(selected);
}
