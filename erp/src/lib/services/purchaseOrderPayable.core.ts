import Decimal from 'decimal.js';

/**
 * What a purchase order actually owes once goods arrive (ARGUS #225).
 *
 * `PurchaseOrder.totalAmount` stores the *expected* order value captured at
 * creation. Receipts record the quantity and actual unit cost that the supplier
 * invoiced, which can differ from the expected cost and can arrive in parts.
 * Paying the expected total then overpays (or, when the invoice is higher, the
 * payment API refuses the real amount).
 *
 * The payable is therefore derived from the received quantities:
 * - no receipts yet -> the expected total (the order can still be paid upfront);
 * - otherwise the received value (received qty x actual cost, falling back to
 *   expected cost for lines without an actual) minus the proportionate share of
 *   the order discount.
 */

type Decimalish = number | string | { toString(): string };

export interface PurchaseOrderCostingLine {
  orderedQty: number;
  receivedQty: number;
  expectedCostPrice: Decimalish;
  actualCostPrice?: Decimalish | null | undefined;
}

export interface PurchaseOrderPayable {
  /** Expected value of all ordered lines. */
  expectedSubtotal: number;
  /** Value of the received quantities at their actual (or expected) cost. */
  receivedSubtotal: number;
  /** Discount apportioned to the received share. */
  receivedDiscount: number;
  /** What is payable now. */
  payable: number;
  /** True once at least one unit has been received. */
  hasReceipts: boolean;
}

function money(value: Decimal): number {
  return value.toDecimalPlaces(2).toNumber();
}

export function computePurchaseOrderPayable(
  lines: PurchaseOrderCostingLine[],
  discountAmount: Decimalish,
  storedTotal: Decimalish,
): PurchaseOrderPayable {
  const expectedSubtotal = lines.reduce(
    (sum, line) => sum.plus(new Decimal(line.expectedCostPrice.toString()).times(line.orderedQty)),
    new Decimal(0),
  );

  const receivedSubtotal = lines.reduce((sum, line) => {
    if (line.receivedQty <= 0) return sum;
    const unitCost =
      line.actualCostPrice !== null && line.actualCostPrice !== undefined
        ? new Decimal(line.actualCostPrice.toString())
        : new Decimal(line.expectedCostPrice.toString());
    return sum.plus(unitCost.times(line.receivedQty));
  }, new Decimal(0));

  const hasReceipts = lines.some((line) => line.receivedQty > 0);

  if (!hasReceipts) {
    // Nothing received: the expected total (already net of the full discount)
    // is still the amount that will be owed.
    return {
      expectedSubtotal: money(expectedSubtotal),
      receivedSubtotal: 0,
      receivedDiscount: 0,
      payable: money(new Decimal(storedTotal.toString())),
      hasReceipts: false,
    };
  }

  const received = money(receivedSubtotal);
  const discount = new Decimal(discountAmount.toString());
  const receivedDiscount =
    discount.lessThanOrEqualTo(0) || expectedSubtotal.lessThanOrEqualTo(0)
      ? new Decimal(0)
      : Decimal.min(
          discount.times(receivedSubtotal).dividedBy(expectedSubtotal),
          receivedSubtotal,
        );

  return {
    expectedSubtotal: money(expectedSubtotal),
    receivedSubtotal: received,
    receivedDiscount: money(receivedDiscount),
    payable: money(receivedSubtotal.minus(receivedDiscount)),
    hasReceipts: true,
  };
}
