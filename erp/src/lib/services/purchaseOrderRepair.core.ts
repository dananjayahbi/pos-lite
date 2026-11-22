import Decimal from 'decimal.js';

/**
 * Pure repair planning for legacy/demo purchase orders (ARGUS #232).
 *
 * Old seed rows were created with `subtotalAmount` left at its 0 default and
 * their stock was incremented directly without a `PURCHASE_RECEIVED` movement.
 * Live data is never rewritten silently: the script that consumes these
 * planners is dry-run by default and only applies the plans that are provably
 * safe.
 *
 * Two independent questions are answered here:
 * 1. Is the stored subtotal the sum of the ordered lines, and does the stored
 *    total still equal `subtotal - discount`?
 * 2. Can the missing receipt movement be reconstructed without changing stock?
 */

type Decimalish = number | string | { toString(): string };

export interface PurchaseOrderRepairLine {
  orderedQty: number;
  expectedCostPrice: Decimalish;
  receivedQty: number;
}

function money(value: Decimal): number {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

function decimal(value: Decimalish): Decimal {
  const parsed = new Decimal(value.toString());
  return parsed.isFinite() ? parsed : new Decimal(0);
}

/** Sum of `orderedQty x expectedCostPrice`, rounded to cents. */
export function computePurchaseOrderLinesSubtotal(lines: PurchaseOrderRepairLine[]): number {
  return money(
    lines.reduce(
      (sum, line) => sum.plus(decimal(line.expectedCostPrice).times(line.orderedQty)),
      new Decimal(0),
    ),
  );
}

export type PurchaseOrderSubtotalRepairPlan =
  | { status: 'ok'; subtotal: number }
  | { status: 'repair'; subtotal: number; previousSubtotal: number }
  | { status: 'manual'; subtotal: number; reason: string };

export interface PurchaseOrderTotalsInput {
  subtotalAmount: Decimalish;
  discountAmount: Decimalish;
  totalAmount: Decimalish;
}

/**
 * Plan the subtotal fix.
 *
 * The subtotal is only rewritten when the lines agree with the stored total:
 * `subtotal - discount = total`. If the total disagrees, the row carries a
 * financial decision the script cannot infer (a manual discount, an edited
 * total, ...), so it is reported for operator review instead.
 */
export function planPurchaseOrderSubtotalRepair(
  po: PurchaseOrderTotalsInput,
  lines: PurchaseOrderRepairLine[],
): PurchaseOrderSubtotalRepairPlan {
  const computed = computePurchaseOrderLinesSubtotal(lines);
  const previousSubtotal = money(decimal(po.subtotalAmount));
  const discount = money(decimal(po.discountAmount));
  const storedTotal = money(decimal(po.totalAmount));
  const expectedTotal = money(new Decimal(computed).minus(discount));

  if (storedTotal !== expectedTotal) {
    return {
      status: 'manual',
      subtotal: computed,
      reason:
        `stored total ${storedTotal.toFixed(2)} does not equal lines subtotal ` +
        `${computed.toFixed(2)} minus discount ${discount.toFixed(2)} (${expectedTotal.toFixed(2)})`,
    };
  }

  if (previousSubtotal === computed) {
    return { status: 'ok', subtotal: computed };
  }

  return { status: 'repair', subtotal: computed, previousSubtotal };
}

export type ReceiptMovementRepairPlan =
  | { status: 'none' }
  | { status: 'already' }
  | { status: 'create'; quantityDelta: number; quantityBefore: number; quantityAfter: number }
  | { status: 'manual'; reason: string };

export interface ReceiptMovementRepairInput {
  receivedQty: number;
  /** True when this PO already has a PURCHASE_RECEIVED movement for the variant. */
  hasReceiptMovement: boolean;
  /** `quantityAfter` of the latest movement for the variant, null when none exist. */
  ledgerTail: number | null;
  currentStock: number;
}

/**
 * Plan a missing receipt movement without touching stock.
 *
 * The safe case is exactly the legacy seed shape: stock already includes the
 * received units (it was incremented directly), while the ledger still ends at
 * the pre-receipt quantity. Then `currentStock - ledgerTail === receivedQty`
 * and appending `tail -> currentStock` both closes the chain and matches stock.
 *
 * Any other gap means something else changed the ledger; guessing would either
 * double-count stock or rewrite history, so the line is reported as manual.
 */
export function planReceiptMovementRepair(
  input: ReceiptMovementRepairInput,
): ReceiptMovementRepairPlan {
  if (input.receivedQty <= 0) return { status: 'none' };
  if (input.hasReceiptMovement) return { status: 'already' };

  const tail = input.ledgerTail ?? 0;
  if (tail < 0) {
    return { status: 'manual', reason: `ledger tail is negative (${tail})` };
  }

  const gap = input.currentStock - tail;
  if (gap === input.receivedQty) {
    return {
      status: 'create',
      quantityDelta: input.receivedQty,
      quantityBefore: tail,
      quantityAfter: input.currentStock,
    };
  }

  if (gap === 0) {
    return {
      status: 'manual',
      reason:
        'stock already matches the ledger tail - adding a synthetic receipt would overstate stock',
    };
  }

  return {
    status: 'manual',
    reason:
      `stock/ledger gap ${gap} does not match the received quantity ${input.receivedQty}; ` +
      'the ledger changed after the seed and needs manual review',
  };
}
