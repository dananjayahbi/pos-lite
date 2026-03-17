# Task 03.03.02 — Build Return Service Layer

## Metadata

| Field          | Value                                          |
| -------------- | ---------------------------------------------- |
| Task ID        | 03.03.02                                       |
| Name           | Build Return Service Layer                     |
| SubPhase       | 03.03 — Returns and Exchanges                  |
| Status         | Not Started                                    |
| Complexity     | HIGH                                           |
| Dependencies   | Task_03_03_01 complete                         |
| Output Files   | src/lib/services/return.service.ts             |

---

## Objective

Implement the `return.service.ts` service layer that powers every return operation in VelvetPOS. This service handles eligibility validation, proportional refund computation, and atomic database writes — ensuring that inventory adjustments, return records, and store credit issuance all succeed together or not at all.

---

## Context

Returns are the most operationally sensitive action in a POS system. A failure midway through a return (e.g., the database write succeeds but the inventory adjustment does not) can leave the business with a cash outflow and no corresponding stock. The entire service is built around a single Prisma `$transaction` call to prevent any such split-brain state. The `isRestocked` field on each `ReturnLine` is updated inside the same transaction after a successful `adjustStock` call, providing a per-line audit trail of exactly which stock changes were applied.

The 30-day return window is hard-coded in Phase 03. A configurable tenant-level `returnWindowDays` field will be introduced in Phase 04 when tenant settings are expanded.

---

## Instructions

### Step 1: Create the Service File

Create the file `src/lib/services/return.service.ts`. Import Prisma types, the shared `prisma` singleton, `decimal.js`, and the `adjustStock` function from `inventory.service.ts`. Also import the `ReturnRefundMethod` and `ReturnStatus` enums from the Prisma client.

### Step 2: Define the RETURN_WINDOW_DAYS Constant

Declare a module-level constant `RETURN_WINDOW_DAYS = 30`. This is the only place the 30-day rule is encoded in Phase 03. Every eligibility check references this constant.

### Step 3: Implement getRemainingReturnableQty

This helper function accepts a `saleLineId` and a Prisma transaction client. It queries all `ReturnLine` records that reference the given `saleLineId` and are associated with a `Return` of status `COMPLETED`. It sums their `quantity` values and returns the result as a number. The calling code subtracts this from the original `SaleLine.quantity` to determine how many units are still eligible for return.

### Step 4: Implement validateReturnEligibility

This function accepts `tenantId`, `originalSaleId`, and an array of `{ saleLineId, quantity }` objects. It must be called before any write operations.

Validation rules to enforce in order:

- The `Sale` with the given `originalSaleId` must exist and its `tenantId` must match the caller's `tenantId`. If not, throw a descriptive error identifying the mismatch.
- The `Sale.status` must be `COMPLETED`. Voided sales and open sales cannot be returned.
- The sale's `createdAt` must be within `RETURN_WINDOW_DAYS` of the current date (compare UTC dates). If outside the window, throw with a message that includes the sale date and the expiry date so UI can display it.
- Each `saleLineId` in the request must belong to the given `originalSaleId`. Throw if a line belongs to a different sale.
- For each line, the requested `quantity` must be greater than zero and must not exceed the remaining returnable quantity (original `SaleLine.quantity` minus already-returned quantity). If the requested quantity exceeds what is available, throw with line-level detail including which variant is over-limit.

The function returns the fully loaded `Sale` including `saleLines` so downstream functions do not need to re-query it.

### Step 5: Implement computeLineRefundAmounts

This pure function accepts the validated `Sale` (with lines) and the return request lines. For each return line, it finds the matching `SaleLine` and computes the refund as a proportional share of the line's final value: `(returnQty / originalQty) × lineTotalAfterDiscount`. All arithmetic uses `decimal.js` to avoid floating-point errors. The function returns an array of `{ saleLineId, variantId, quantity, unitPrice, lineRefundAmount }` objects and the grand total refund as a `Decimal`. The grand total is the sum of all `lineRefundAmount` values.

### Step 6: Implement initiateReturn

This is the primary public function of the service. It accepts:

- `tenantId: string`
- `input: { initiatedById, authorizedById, originalSaleId, lines: [{ saleLineId, variantId, quantity }], refundMethod, restockItems, reason }`

The entire body runs inside `prisma.$transaction(async (tx) => { ... })`.

Inside the transaction:

1. Call `validateReturnEligibility` (passing the `tx` client) to confirm the return is valid.
2. Call `computeLineRefundAmounts` to get per-line refund values and total.
3. Create the `Return` record using `tx.return.create`, with `status: COMPLETED`, the computed `refundAmount`, and all other scalar fields from the input.
4. Create all `ReturnLine` records using `tx.returnLine.createMany`, setting `isRestocked: false` for every line initially.
5. If `restockItems` is `true`, loop through each return line and call `adjustStock` (passing `tx`) with `reason: SALE_RETURN` and `delta: +quantity`. Immediately after each successful `adjustStock` call, update the corresponding `ReturnLine` using `tx.returnLine.update` to set `isRestocked: true`. This per-line update ensures the audit trail is accurate even if a future step fails — though the outer `$transaction` will roll back all writes together.
6. If `refundMethod` is `STORE_CREDIT`, create a `StoreCredit` record using `tx.storeCredit.create` with `amount: totalRefundAmount`, `tenantId`, and `note: "Return ref " + returnRecord.id`.
7. Return the fully loaded `Return` record including its `returnLines` and the `originalSale` using `tx.return.findUniqueOrThrow`.

### Step 7: Implement getReturnById

Accepts `tenantId` and `returnId`. Fetches the `Return` using `prisma.return.findUniqueOrThrow` with `where: { id: returnId, tenantId }`. Includes `returnLines`, `originalSale`, `initiatedBy` (User), and `authorizedBy` (User). Throws a `NotFoundError` if the return does not belong to the tenant.

### Step 8: Implement getReturns

Accepts `tenantId` and an optional filters object containing `originalSaleId`, `initiatedById`, `refundMethod`, `from: Date`, `to: Date`, `page: number`, and `limit: number`. Constructs a Prisma `where` clause from the provided filters (each field only included when defined). Returns a paginated result with a `data` array and a `total` count. The default `limit` is 25, and the maximum should be capped at 100 to prevent over-fetching.

---

## Expected Output

A single `return.service.ts` file exporting: `initiateReturn`, `getReturnById`, `getReturns`, and the internal helpers `validateReturnEligibility`, `computeLineRefundAmounts`, and `getRemainingReturnableQty` (these can be unexported if the file is the only consumer).

---

## Validation

- Calling `initiateReturn` with a sale older than 30 days throws with a clear error message containing the expiry date.
- Calling `initiateReturn` with a quantity exceeding the remaining returnable quantity throws a line-level error.
- After a successful call, the database contains a `Return` record, the correct number of `ReturnLine` records, and (if applicable) a `StoreCredit` record.
- When `restockItems: true`, `StockMovement` records exist for each returned variant with reason `SALE_RETURN` and a positive delta.
- When `restockItems: false`, no `StockMovement` records are created and all `ReturnLine.isRestocked` values remain `false`.

---

## Notes

The `adjustStock` function from `inventory.service.ts` must accept an optional Prisma transaction client as its last argument so it can participate in the outer transaction. Verify that this is the case before writing `return.service.ts`. If `adjustStock` does not yet support a transaction client parameter, update `inventory.service.ts` to accept one as an optional last argument, defaulting to the singleton `prisma` instance if not provided.
