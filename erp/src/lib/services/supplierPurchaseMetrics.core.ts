/**
 * ARGUS #239 - supplier purchase-order metrics.
 *
 * The supplier row showed only `_count.purchaseOrders`, an all-status count.
 * "14" read as active purchasing activity even when it was 9 drafts, 4
 * cancellations and one receipt, and no money context was shown. This pure
 * summary keeps the table honest: a status split plus the committed value and
 * the still-outstanding balance.
 */

export interface SupplierPurchaseOrderRow {
  status: string;
  totalAmount: number | string;
  /** Money applied across instalments for this PO. */
  paidAmount?: number | string | undefined;
}

export interface SupplierPurchaseSummary {
  total: number;
  draft: number;
  open: number;
  received: number;
  cancelled: number;
  /** Total value of SENT / PARTIALLY_RECEIVED / RECEIVED orders. */
  committedValue: number;
  /** Committed value minus payments already applied. */
  outstandingValue: number;
}

function money(value: number | string | undefined): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.round(parsed * 100) / 100;
}

export function summarizeSupplierPurchaseOrders(
  rows: readonly SupplierPurchaseOrderRow[],
): SupplierPurchaseSummary {
  const summary: SupplierPurchaseSummary = {
    total: rows.length,
    draft: 0,
    open: 0,
    received: 0,
    cancelled: 0,
    committedValue: 0,
    outstandingValue: 0,
  };

  for (const row of rows) {
    const total = money(row.totalAmount);
    const paid = money(row.paidAmount);
    switch (row.status) {
      case 'DRAFT':
        summary.draft += 1;
        break;
      case 'SENT':
      case 'PARTIALLY_RECEIVED':
        summary.open += 1;
        summary.committedValue += total;
        summary.outstandingValue += Math.max(0, total - paid);
        break;
      case 'RECEIVED':
        summary.received += 1;
        summary.committedValue += total;
        summary.outstandingValue += Math.max(0, total - paid);
        break;
      case 'CANCELLED':
        summary.cancelled += 1;
        break;
      default:
        // Unknown future status: count it in the total only.
        break;
    }
  }

  summary.committedValue = money(summary.committedValue);
  summary.outstandingValue = money(summary.outstandingValue);
  return summary;
}
