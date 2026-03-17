# Task 04.01.08 — Build Purchase Order Service

## Metadata

| Field | Value |
|---|---|
| Task ID | 04.01.08 |
| Task Name | Build Purchase Order Service |
| SubPhase | 04.01 — CRM and Supplier Management |
| Complexity | High |
| Estimated Effort | 4–5 hours |
| Prerequisites | 04.01.01 (PurchaseOrder models), adjustStock service (SubPhase 02.03) |
| Output | `src/lib/services/purchaseOrder.service.ts` |

---

## Objective

Create the complete server-side service layer for the Purchase Order and procurement cycle. This service handles PO creation, status querying, status transitions, goods receiving (the most complex operation), and WhatsApp message formatting. The goods receiving function is the integration point between the procurement cycle and the inventory system — it calls `adjustStock` within a database transaction to ensure stock and PO state are always kept in sync.

---

## Context

The `adjustStock` service function already exists from SubPhase 02.03 and accepts an optional Prisma transaction client as its last parameter, making it composable inside `$transaction` blocks. The `StockMovementReason` enum includes `PURCHASE_RECEIVED` which is the reason code used when goods arrive from a supplier. The `ProductVariant.costPrice` field is updated inline during goods receiving when the `actualCostPrice` entered by staff differs from the recorded value, ensuring that the gross margin calculations in reports remain accurate.

---

## Instructions

### Step 1: Create the File and Define Imports

Create `src/lib/services/purchaseOrder.service.ts`. Import `prisma` from `src/lib/prisma`, `Decimal` from `decimal.js`, `adjustStock` from the stock service, and `StockMovementReason` and `POStatus` from the Prisma client. Define the transaction client type alias consistent with the rest of the project's service files.

### Step 2: Implement createPO

The `createPO` function accepts `tenantId`, `createdById`, and an input object: `{ supplierId, lines: [{ variantId, orderedQty, expectedCostPrice }], expectedDeliveryDate?, notes? }`.

Validate that `lines` is non-empty — throw if the array is empty. Verify the supplier belongs to the tenant by fetching it and checking `supplier.tenantId === tenantId`. For each line, fetch the `ProductVariant` to capture `productNameSnapshot` (from `variant.product.name`) and `variantDescriptionSnapshot` (from the variant's size/colour/description — use whatever composite description string the variant model uses based on SubPhase 02 conventions).

Compute `totalAmount` as the sum of `orderedQty × expectedCostPrice` for all lines, using `decimal.js` for the arithmetic to avoid floating-point errors.

Call `prisma.purchaseOrder.create` with nested `create` for the lines. Set `status: POStatus.DRAFT`, `totalAmount` as computed, and all provided fields. Return the created PO with its lines.

### Step 3: Implement getPOById

The `getPOById` function accepts `tenantId` and `poId`. Fetch with `prisma.purchaseOrder.findFirst` where `id` and `tenantId` match. Include `supplier` (all fields), `createdBy` (id, name), and `lines` including each line's `variant` (with `product.name`, `images`, current `costPrice`, `stockQuantity`) and the snapshot fields. Return the PO or throw a typed 404 error.

### Step 4: Implement getPOs

The `getPOs` function accepts `tenantId` and an options object: `{ supplierId?, status?, from?, to?, page, limit }`. Build a `where` clause starting from `{ tenantId }`. Append `supplierId` filter if provided. Append `status` filter if provided. Append a `createdAt: { gte: from, lte: to }` filter if date range is provided. Execute `findMany` with `orderBy: { createdAt: 'desc' }`, pagination, and include `supplier.name` and `_count: { select: { lines: true } }`. Execute a parallel `count`. Return the paginated result.

### Step 5: Implement updatePOStatus

The `updatePOStatus` function accepts `tenantId`, `poId`, and `newStatus: POStatus`. Fetch the current PO to validate the transition is legal. Allowed transitions: `DRAFT` → `SENT`, `DRAFT` → `CANCELLED`, `SENT` → `CANCELLED`. If the transition is illegal (e.g., attempting to set a `RECEIVED` PO back to `DRAFT`), throw an error with a descriptive message listing the current status. Call `prisma.purchaseOrder.update` and return the updated PO.

### Step 6: Implement cancelPO

The `cancelPO` function accepts `tenantId` and `poId`. Fetch the PO and confirm its status is `DRAFT` or `SENT`. If neither, throw "Only DRAFT or SENT purchase orders can be cancelled." Call `prisma.purchaseOrder.update` setting `status: POStatus.CANCELLED`. Note: cancellation does not reverse any stock adjustments because no stock changes are made until goods are physically received. Return the updated PO.

### Step 7: Implement receivePOLines (Core Function)

The `receivePOLines` function accepts `tenantId`, `poId`, an `input` object `{ receivedLines: [{ lineId, receivedQty, actualCostPrice? }] }`, and `actorId` (the user triggering the receipt).

This function runs inside a `prisma.$transaction` block. At the start of the transaction:

1. Fetch the PO (with all lines) using the transaction client `tx`. Validate it exists and belongs to the tenant. Validate its status is not `CANCELLED` or `RECEIVED` — if either, throw "Cannot receive goods against a cancelled or already-received purchase order."

2. Initialise a `costPricesChanged` array to track variants whose cost price was updated.

3. For each entry in `receivedLines`: find the matching `PurchaseOrderLine` by `lineId`. Validate that `receivedQty` is greater than zero. Validate that `line.receivedQty + receivedQty <= line.orderedQty` — if this would exceed the ordered quantity, throw a per-line error "Cannot receive more than the ordered quantity for [productNameSnapshot]."

4. Call `adjustStock(variantId, receivedQty, StockMovementReason.PURCHASE_RECEIVED, tx)` using the transaction client.

5. Update the `PurchaseOrderLine` using `tx.purchaseOrderLine.update`: increment `receivedQty` by the received amount, set `actualCostPrice` if provided, set `isFullyReceived = (updatedReceivedQty >= orderedQty)`.

6. If `actualCostPrice` is provided and it differs from the variant's current `costPrice` (fetched in sub-step for each line), update `tx.productVariant.update` setting `costPrice: actualCostPrice` and push `{ variantId, variantDescription, oldCostPrice, newCostPrice }` to the `costPricesChanged` array.

After processing all lines, re-fetch all PO lines to determine the new PO status. If every line has `isFullyReceived = true`, set the new status to `RECEIVED`. If at least one line has `receivedQty > 0` but not all are fully received, set status to `PARTIALLY_RECEIVED`. Update the PO status using `tx.purchaseOrder.update`.

Return outside the `$transaction` wrapper: `{ updatedPO, costPricesChanged, costPriceChangedCount: costPricesChanged.length }`.

### Step 8: Implement formatPOForWhatsApp

The `formatPOForWhatsApp` function accepts the result of `getPOById`. It is a pure function (no database calls) that constructs and returns a plain-text string.

The formatted message structure:

- Header line: the store name in uppercase (derived from `tenant.name` — add `tenant` to the include in `getPOById`) followed by a line of dashes.
- Section: "PURCHASE ORDER" and the PO ID (short form — last 8 characters of the `cuid` for brevity).
- Supplier line: "Supplier: [supplier.name]".
- Delivery line: "Expected Delivery: [date formatted as DD/MM/YYYY]" or "Not specified" if null.
- A separator line of dashes.
- A numbered list of lines: each in the format "[N]. [productNameSnapshot] - [variantDescriptionSnapshot] | Qty: [orderedQty] | Cost: Rs. [expectedCostPrice]".
- A separator line.
- A total line: "TOTAL: Rs. [totalAmount]".
- A footer: "This order was generated by VelvetPOS. Please confirm receipt by replying to this message."

Use ASCII dashes (`-`) for separators. Keep line lengths under 60 characters where possible for WhatsApp readability on small screens.

---

## Expected Output

- `src/lib/services/purchaseOrder.service.ts` — eight exported functions.
- All functions fully typed with TypeScript strict-mode compatible signatures.
- `receivePOLines` wrapped in `$transaction` with `adjustStock` called per line.

---

## Validation

- [ ] `createPO` with an empty `lines` array throws an error.
- [ ] `createPO` with two lines computes `totalAmount` correctly using decimal.js arithmetic.
- [ ] `cancelPO` on a `RECEIVED` PO throws the expected error.
- [ ] `receivePOLines` with a `receivedQty` exceeding the ordered quantity throws a per-line validation error.
- [ ] After calling `receivePOLines`, `ProductVariant.stockQuantity` is incremented by the received qty for each line.
- [ ] If `receivedQty === orderedQty` for all lines, the PO status becomes `RECEIVED`.
- [ ] If only one of two lines is fully received, the PO status becomes `PARTIALLY_RECEIVED`.
- [ ] `formatPOForWhatsApp` returns a string containing the supplier name, total amount, and all line items.

---

## Notes

- The `receivePOLines` function must validate each individual line's `lineId` against the PO's own `lines` array (fetched inside the transaction) to prevent a tenant sidejacking attack where a malicious `lineId` belonging to a different tenant's PO is submitted.
- The `adjustStock` function call must use the `tx` transaction client — not the global `prisma` client — to ensure the stock update is rolled back if any part of the receiving transaction fails.
- `formatPOForWhatsApp` should be tested in isolation because it has no side effects and is easy to unit test. In Phase 04, test it by calling it manually in a seed script or temporary debug route.
- The `costPricesChanged` return value is consumed by the frontend in Task 04.01.10 to show the post-receipt cost price update dialog.
