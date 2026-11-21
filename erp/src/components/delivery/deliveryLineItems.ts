/**
 * ARGUS #271 - delivery detail item lines.
 *
 * `GET /api/store/deliveries/[id]` already includes the delivery's
 * `lines` snapshots. Prisma Decimal values arrive as strings, so the view maps
 * them to plain numbers and keeps the SKU fallback in one pure helper.
 */
import type { DeliveryLineItem } from '@/types/delivery';

type Decimalish = number | string | { toString(): string };

export interface DeliveryLineInput {
  id?: string | undefined;
  productNameSnapshot: string;
  skuSnapshot?: string | null | undefined;
  quantity: number;
  unitPrice: Decimalish;
  lineTotal: Decimalish;
}

export interface DeliveryLineRow {
  id?: string | undefined;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

function toNumber(value: Decimalish | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const num = typeof value === 'number' ? value : Number(value.toString());
  return Number.isFinite(num) ? num : 0;
}

export function toDeliveryLineRows(
  lines: readonly DeliveryLineInput[] | null | undefined,
): DeliveryLineRow[] {
  return (lines ?? []).map((line) => ({
    id: line.id,
    productName: line.productNameSnapshot,
    sku: line.skuSnapshot?.trim() || '-',
    quantity: line.quantity,
    unitPrice: toNumber(line.unitPrice),
    lineTotal: toNumber(line.lineTotal),
  }));
}

/** Sum of the recorded line totals, independent of the order-level COD. */
export function deliveryLinesTotal(
  lines: readonly DeliveryLineInput[] | null | undefined,
): number {
  return toDeliveryLineRows(lines).reduce((total, line) => total + line.lineTotal, 0);
}

/** Narrow the API payload type to the helper's input shape. */
export function toLineInputs(
  lines: readonly DeliveryLineItem[] | null | undefined,
): DeliveryLineInput[] {
  return (lines ?? []).map((line) => ({
    id: line.id,
    productNameSnapshot: line.productNameSnapshot,
    skuSnapshot: line.skuSnapshot,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    lineTotal: line.lineTotal,
  }));
}
