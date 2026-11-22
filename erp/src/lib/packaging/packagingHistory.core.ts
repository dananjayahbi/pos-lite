/**
 * Packaging consumption history (ARGUS #281).
 *
 * `PackagingConsumption` is the reconciliation source for packaging stock, but
 * the stock page only showed balances. This pure mapper turns a consumption row
 * (with its delivery and item) into the bounded DTO the history table renders,
 * so the list, any future per-item expansion and the tests share one shape.
 */
import { formatPackagingQuantity } from '@/lib/constants/packaging';

export interface PackagingHistorySource {
  id: string;
  deliveryId: string;
  orderRef: string | null;
  saleId: string | null;
  packagingItemId: string;
  itemName: string;
  itemSku: string | null;
  unit: string;
  quantity: number | string;
  createdAt: Date | string;
}

export interface PackagingHistoryRow {
  id: string;
  deliveryId: string;
  /** Human reference for the delivery/order (falls back to the delivery id). */
  reference: string;
  orderRef: string | null;
  saleId: string | null;
  itemId: string;
  itemName: string;
  itemSku: string | null;
  unit: string;
  quantity: number;
  /** Quantity with its compact unit, e.g. "2.5 m". */
  quantityLabel: string;
  createdAt: string;
}

/** Map one consumption row to the history DTO. */
export function toPackagingHistoryRow(row: PackagingHistorySource): PackagingHistoryRow {
  const quantity = Number(row.quantity);
  return {
    id: row.id,
    deliveryId: row.deliveryId,
    reference: row.orderRef?.trim() || row.deliveryId,
    orderRef: row.orderRef,
    saleId: row.saleId,
    itemId: row.packagingItemId,
    itemName: row.itemName,
    itemSku: row.itemSku,
    unit: row.unit,
    quantity,
    quantityLabel: formatPackagingQuantity(quantity, row.unit),
    createdAt: new Date(row.createdAt).toISOString(),
  };
}
