/**
 * ARGUS #45 - Recent Stock Movements badge labels.
 *
 * The dashboard card kept its own reason map that stopped at stock-take
 * adjustments, so SALE and VOID_REVERSAL (the two most common rows) leaked the
 * raw enum token. The map now covers every `StockMovementReason`; unknown
 * values still fall back to the shared label helper instead of crashing.
 */

import { stockMovementReasonLabel } from '@/lib/constants/stock-movement';

export interface MovementReasonBadge {
  label: string;
  className: string;
}

const NEUTRAL_CLASS = 'bg-gray-100 text-gray-800 hover:bg-gray-100';

const BADGES: Record<string, { label: string; className: string }> = {
  FOUND: { label: 'Found', className: 'bg-green-100 text-green-800 hover:bg-green-100' },
  PURCHASE_RECEIVED: {
    label: 'Purchase Received',
    className: 'bg-green-100 text-green-800 hover:bg-green-100',
  },
  INITIAL_STOCK: {
    label: 'Initial Stock',
    className: 'bg-green-100 text-green-800 hover:bg-green-100',
  },
  MANUFACTURED: {
    label: 'Manufactured',
    className: 'bg-green-100 text-green-800 hover:bg-green-100',
  },
  SALE_RETURN: {
    label: 'Sale Return',
    className: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
  },
  RETURNED_TO_SUPPLIER: {
    label: 'Returned to Supplier',
    className: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
  },
  VOID_REVERSAL: {
    label: 'Void reversal',
    className: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
  },
  DAMAGED: { label: 'Damaged', className: 'bg-red-100 text-red-800 hover:bg-red-100' },
  STOLEN: { label: 'Stolen', className: 'bg-red-100 text-red-800 hover:bg-red-100' },
  DATA_ERROR: {
    label: 'Data Error',
    className: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  },
  STOCK_TAKE_ADJUSTMENT: {
    label: 'Stock Take',
    className: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  },
  SALE: { label: 'Sale', className: 'bg-blue-100 text-blue-800 hover:bg-blue-100' },
  WEBSITE_ORDER: {
    label: 'Website Order',
    className: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  },
};

export function movementReasonBadge(reason: string | null | undefined): MovementReasonBadge {
  if (!reason) return { label: '-', className: NEUTRAL_CLASS };
  const badge = BADGES[reason];
  if (badge) return badge;
  return { label: stockMovementReasonLabel(reason), className: NEUTRAL_CLASS };
}
