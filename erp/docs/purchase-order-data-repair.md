# Repairing legacy purchase-order totals and receipt movements

Three QA/demo rows (PO-202609-0001, PO-202609-0002, PO-202610-0002) were created
by older seed code that:

- never set `subtotalAmount`, so it kept the 0 default while `totalAmount` held
  the real order value; and
- incremented `ProductVariant.stockQuantity` directly instead of going through
  the goods-receipt service, so already-received POs have no
  `PURCHASE_RECEIVED` stock movement.

The current create/edit path computes subtotal correctly. Existing live rows are
not rewritten silently: the repair is a dry-run-first script.

## Script

`erp/scripts/repair-purchase-orders.ts`:

```
node --env-file=.env --import tsx scripts/repair-purchase-orders.ts
node --env-file=.env --import tsx scripts/repair-purchase-orders.ts --tenant=<tenantId>
node --env-file=.env --import tsx scripts/repair-purchase-orders.ts --po=<purchaseOrderId>
node --env-file=.env --import tsx scripts/repair-purchase-orders.ts --apply
```

Without `--apply` it only prints the plan. It is idempotent: a repaired subtotal
plans as `ok` and an existing receipt movement plans as `already`.

## Safe repairs

`planPurchaseOrderSubtotalRepair()` (`src/lib/services/purchaseOrderRepair.core.ts`):

- subtotal is `sum(orderedQty x expectedCostPrice)`, rounded to cents;
- it is written only when the stored `totalAmount` still equals
  `computedSubtotal - discountAmount`;
- if the total disagrees with the lines (a manual discount, an edited total), the
  row is reported as **manual** and left untouched.

`planReceiptMovementRepair()`:

- a receipt movement is appended only when
  `currentStock - ledgerTail === receivedQty`, i.e. stock already includes the
  receipt and the ledger simply never recorded it;
- the movement goes `ledgerTail -> currentStock`, so the chain stays continuous
  and **no stock quantity is changed**;
- if the gap is zero, negative or does not match the received quantity, later
  ledger activity makes the history ambiguous and the line is reported as
  **manual**.

Every write runs in one transaction that locks the PO row and each affected
variant row, and it records a `PURCHASE_ORDER_REPAIRED` audit row with the
reconstructed movements. `receivedQty`, `isFullyReceived`, status and stock are
never modified.

## What needs an operator

- A stored total that does not equal `lines - discount` (the script cannot infer
  which side is wrong).
- A stock/ledger gap that is not exactly the received quantity, usually because
  later sales or adjustments ran after the direct seed increment.
- Multiple received POs sharing a variant where only one missing receipt fits the
  current gap; the first is repairable, the rest need review.

## Verification

`src/lib/services/__tests__/purchaseOrderRepair.core.test.ts` covers the three
reported rows, the discount equation, idempotent `ok`, manual total mismatches,
the safe receipt append, existing/zero/mismatched gaps, a negative tail and a
variant with no prior movements.
