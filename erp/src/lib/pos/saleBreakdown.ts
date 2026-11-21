/**
 * Receipt-style breakdown for the sale detail modal.
 *
 * `Sale.subtotal` is persisted as the sum of each line's
 * `lineTotalAfterDiscount` (see `createSale` / `createHeldSale`), so it is
 * already net of line-level discounts. The rendered rows therefore subtract
 * only the cart-level discount and add tax and delivery. Re-subtracting the
 * line discounts double-counts them and makes the visible rows disagree with
 * the recorded total (ARGUS #75).
 *
 * The full sale detail page (`/sales/[saleId]`) renders the same four
 * components; this helper keeps the modal on that math.
 */

export type SaleBreakdownKey = 'subtotal' | 'discount' | 'tax' | 'delivery';

export interface SaleBreakdownRow {
  key: SaleBreakdownKey;
  label: string;
  /** Positive magnitude; `sign` carries the direction. */
  amount: number;
  sign: 1 | -1;
}

export interface SaleBreakdownInput {
  subtotal: number | string | null | undefined;
  discountAmount?: number | string | null | undefined;
  taxAmount?: number | string | null | undefined;
  deliveryCharge?: number | string | null | undefined;
  /** When supplied, the helper reports whether the rows add up to it. */
  totalAmount?: number | string | null | undefined;
}

export interface SaleBreakdown {
  rows: SaleBreakdownRow[];
  /** Sum of the rendered rows, rounded to paise. */
  rowsTotal: number;
  /** Recorded sale total, rounded to paise; null when not supplied. */
  recordedTotal: number | null;
  /** `rowsTotal === recordedTotal`; null when no recorded total was supplied. */
  reconciles: boolean | null;
}

/** Prisma `Decimal`s reach the client as strings, so accept both. */
function toAmount(value: number | string | null | undefined): number {
  const parsed = typeof value === 'string' ? Number.parseFloat(value) : (value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function saleBreakdown(input: SaleBreakdownInput): SaleBreakdown {
  const rows: SaleBreakdownRow[] = [
    {
      key: 'subtotal',
      label: 'Sub-total',
      amount: round2(toAmount(input.subtotal)),
      sign: 1,
    },
  ];

  const discount = round2(toAmount(input.discountAmount));
  if (discount > 0) {
    rows.push({ key: 'discount', label: 'Cart Discount', amount: discount, sign: -1 });
  }

  const tax = round2(toAmount(input.taxAmount));
  if (tax > 0) {
    rows.push({ key: 'tax', label: 'Tax', amount: tax, sign: 1 });
  }

  const delivery = round2(toAmount(input.deliveryCharge));
  if (delivery > 0) {
    rows.push({ key: 'delivery', label: 'Delivery', amount: delivery, sign: 1 });
  }

  const rowsTotal = round2(rows.reduce((sum, row) => sum + row.sign * row.amount, 0));
  const recordedTotal =
    input.totalAmount === undefined || input.totalAmount === null
      ? null
      : round2(toAmount(input.totalAmount));

  return {
    rows,
    rowsTotal,
    recordedTotal,
    reconciles: recordedTotal === null ? null : rowsTotal === recordedTotal,
  };
}
