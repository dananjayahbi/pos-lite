# Task 03.03.12 — Seed Demo Returns Data

## Metadata

| Field          | Value                                          |
| -------------- | ---------------------------------------------- |
| Task ID        | 03.03.12                                       |
| Name           | Seed Demo Returns Data                         |
| SubPhase       | 03.03 — Returns and Exchanges                  |
| Status         | Not Started                                    |
| Complexity     | LOW                                            |
| Dependencies   | Task_03_03_01 complete (Return models), Task_03_02_12 complete (demo sales exist) |
| Output Files   | prisma/seed.ts (modified)                      |

---

## Objective

Extend the existing `prisma/seed.ts` to add demonstration return records that developers and reviewers can use to validate the returns UI, Return History page, and Z-Report without needing to manually process a return through the POS terminal. Each demo return covers a different scenario to exercise all code paths.

---

## Context

The demo sales were created in Task_03_02_12. The seed adds returns against those sales. Like the demo sales, the demo return seeding must be idempotent — running `pnpm prisma db seed` multiple times must not create duplicate returns. The restocking logic is handled by directly updating `ProductVariant.stockQuantity` rather than calling `return.service.initiateReturn`, because the service function requires a live server context with authentication that is not available in the seed script.

---

## Instructions

### Step 1: Identify the Target Sales and Users

At the start of the returns seed section, look up the seed data created in Task_03_02_12. The seed script should already have references to the demo sales and the demo users (one CASHIER user and one MANAGER user). Confirm these are available in scope before writing the return rows.

The MANAGER user serves as the `authorizedById` for all demo returns. The CASHIER user serves as `initiatedById`.

### Step 2: Add Idempotency Guard

Before creating any return records, query the database for existing Return records belonging to the demo tenant with specific `reason` strings used in the seed. If any of these records already exist, skip the entire return seed block by returning early. Add a console log: "Demo returns already seeded — skipping."

### Step 3: Create Return A — Cash Refund with Restocking

Select the first demo sale that has at least two SaleLines. Return one line item (quantity 1 of the first SaleLine). Use refundMethod CASH. Set `restockItems: true`.

Create the Return record directly via `prisma.return.create` with all required fields. Then create the ReturnLine record via `prisma.returnLine.create`, setting `isRestocked: false` initially.

After creating the ReturnLine, update the associated `ProductVariant.stockQuantity` using `prisma.productVariant.update` to add back the returned quantity (e.g., `stockQuantity: { increment: 1 }`). Then update the ReturnLine to set `isRestocked: true`.

Set `reason: "SEED_DEMO_CASH_REFUND"` on the Return for idempotency detection.

### Step 4: Create Return B — Store Credit, No Restock

Select a different demo sale. Return one full SaleLine. Use refundMethod STORE_CREDIT. Set `restockItems: false`.

Create the Return and ReturnLine records. Leave `isRestocked: false` on the ReturnLine (no stock update because restockItems is false).

Create a `StoreCredit` record using `prisma.storeCredit.create` with `amount` equal to the `lineRefundAmount` of the ReturnLine, `tenantId` of the demo tenant, `customerId: null` (no CRM in Phase 03), and `note: "Demo store credit — Return [returnId]"`.

Set `reason: "SEED_DEMO_STORE_CREDIT"` on the Return for idempotency detection.

### Step 5: Create Return C — Card Reversal, Partial Return

Select a demo sale that has a SaleLine with an original quantity of at least 2. Return quantity 1 out of a total of 2 (partial return). Use refundMethod CARD_REVERSAL. Set `restockItems: true`. Set `cardReversalReference: "DEMO-CARD-REV-9012"`.

Create the Return and ReturnLine. Update the variant stock by incrementing by 1. Update ReturnLine.isRestocked to true.

Set `reason: "SEED_DEMO_CARD_REVERSAL"` on the Return for idempotency detection.

### Step 6: Create Return D — Exchange

Select a fourth demo sale. Return one SaleLine. Use refundMethod EXCHANGE. Set `restockItems: true`.

Create the Return and ReturnLine. Update variant stock. Update isRestocked to true.

This return simulates an exchange that was initiated but whose replacement cart (the linked sale) was never completed — so `linkedReturnId` on a new sale does not exist in seed data. This is fine; it tests the "abandoned exchange" path in the UI.

Set `reason: "SEED_DEMO_EXCHANGE"` on the Return for idempotency detection.

### Step 7: Add Console Logging

After all return records are created, log a summary:
- "Seeded demo returns: 4 returns (1 cash, 1 store credit, 1 card reversal, 1 exchange)"
- "StoreCredit record created for demo Return B"
- "Stock updated for Returns A, C, D (restockItems=true)"

---

## Expected Output

- Four Return records in the demo tenant with varied refundMethod and restockItems combinations
- ReturnLine records attached to each Return
- One StoreCredit record for Return B
- Stock quantities correctly incremented for returns A, C, and D
- Running the seed twice leaves only four Return records (idempotency confirmed)

---

## Validation

- Open Prisma Studio and navigate to the Return table — 4 records exist
- Each Return has at least one ReturnLine in the ReturnLine table
- The StoreCredit table contains one record linked to Return B's tenant
- The ProductVariant records for returned items have their stock quantity correctly incremented
- Running pnpm prisma db seed a second time produces no additional Return records

---

## Notes

The `lineRefundAmount` for each demo ReturnLine should be computed in the seed script as a proportional value. For simplicity in seeding, if the SaleLine has no discount, the computation is straightforward: `returnQty / originalQty * SaleLine.lineTotal`. Use JavaScript `Math.round` or a fixed 2-decimal string conversion to produce a valid Decimal-compatible number. The Prisma client accepts numeric literals for Decimal fields in seed scripts.
