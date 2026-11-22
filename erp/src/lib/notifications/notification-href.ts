/**
 * One notification → internal route mapping (ARGUS #54).
 *
 * The `/notifications` page and the header `NotificationPopover` each carried
 * a private switch, so they could drift (and the page showed an Open button for
 * only a handful of types). This module is the shared definition: a row links
 * when its type has a real destination, otherwise it returns null and the UI
 * renders no button.
 *
 * Safety:
 * - only app-internal paths are produced (never an absolute or protocol URL);
 * - a supplied entity id is URI-encoded and must be a non-empty string;
 * - an unknown type or missing id (where the type needs one) returns null,
 *   never a guessing link.
 */

export interface NotificationHrefInput {
  type: string;
  relatedEntityId?: string | null | undefined;
  /**
   * Producer-provided entity discriminator (`Sale`, `SaleReturn`, `Shift`, …).
   * Kept for callers that want to state the target; the current mapping uses the
   * notification type (which is what producers write) and the id.
   */
  relatedEntityType?: string | null | undefined;
}

function entityPath(id: string | null | undefined): string | null {
  if (typeof id !== 'string') return null;
  const trimmed = id.trim();
  if (!trimmed) return null;
  return encodeURIComponent(trimmed);
}

/** Resolve the internal page a notification row opens, or null when none. */
export function getNotificationHref(input: NotificationHrefInput): string | null {
  const id = entityPath(input.relatedEntityId);

  switch (input.type) {
    case 'SALE_COMPLETED':
      // ARGUS #52: open the sale itself (voided alerts keep the same sale link;
      // the row labels it as Voided).
      return id ? `/sales/${id}` : '/sales';

    case 'RETURN_PROCESSED':
      // Returns are reviewed from the ledger; there is no per-return page.
      return '/returns';

    case 'SHIFT_CLOSED':
      return id ? `/staff/shifts/${id}` : '/staff/shifts';

    case 'LOW_STOCK_ALERT':
      return '/stock-control/low-stock';

    case 'STOCK_TAKE_SUBMITTED':
    case 'STOCK_TAKE_APPROVED':
    case 'STOCK_TAKE_REJECTED':
      return id
        ? `/stock-control/stock-takes/${id}/review`
        : '/stock-control/stock-takes';

    case 'PETTY_CASH_LOW':
      return '/petty-cash';

    case 'RAW_MATERIAL_LOW_STOCK':
      return '/factory/raw-materials?stockStatus=LOW';

    case 'RAW_MATERIAL_CRITICAL':
      return '/factory/raw-materials?stockStatus=OUT';

    case 'BATCH_EXPIRY_SOON':
    case 'BATCH_EXPIRED':
      return '/inventory/batches';

    case 'PACKAGING_LOW_STOCK':
      return '/delivery/packaging';

    case 'DELIVERY_STATUS_UPDATED':
    case 'DELIVERY_FAILED':
    case 'DELIVERY_DISPATCHED':
    case 'DELIVERY_DELIVERED':
    case 'DELIVERY_HELD_EXPIRING':
      return id ? `/delivery/${id}` : '/delivery';

    case 'COD_PENDING_ALERT':
    case 'RECONCILIATION_DISCREPANCY':
      return '/delivery/reconciliation';

    default:
      // SYSTEM_ALERT and any future type without a destination: no Open button
      // rather than a link that goes nowhere.
      return null;
  }
}
