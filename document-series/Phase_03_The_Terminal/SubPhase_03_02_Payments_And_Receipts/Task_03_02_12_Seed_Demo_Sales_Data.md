# Task 03.02.12 — Seed Demo Sales Data

## Metadata

| Field        | Value                                           |
|--------------|-------------------------------------------------|
| Sub-Phase    | 03.02 — Payments, Receipts and Offline Mode     |
| Phase        | 03 — The Terminal                               |
| Complexity   | Low                                             |
| Dependencies | Task 03.02.01 (Payment Model), SubPhase 02.01 catalog data seeded |

---

## Objective

Extend the existing `prisma/seed.ts` script with a block that creates 20 completed demo sales across five consecutive days, using two cashier users, realistic multi-item cart compositions drawn from the sample product catalog, and the correct payment method distribution required for meaningful dashboard and shift report demonstrations.

---

## Instructions

### Step 1: Understand the Existing Seed Structure

Before adding any code, read through the current state of `prisma/seed.ts` to understand how the existing seed blocks are structured. Identify the seeded tenant, the two cashier `User` records created in SubPhase 01.02 (or SubPhase 01.03), the seeded product variants from SubPhase 02.01, and the idempotency pattern already in place — typically a `upsert` or a `findFirst` guard that skips creation if the data already exists.

The new sales seed block must follow the same idempotency pattern. Add an early-exit guard at the start of the sales seed block: query `prisma.sale.count()` for the demo tenant. If the count is already 20 or greater, log the message "Demo sales already seeded — skipping." and return without creating any new records. This prevents accidental duplicate data on subsequent `pnpm prisma db seed` runs.

### Step 2: Define the Seed Data Constants

At the start of the sales seed block, declare a set of constants that define the seeding parameters. These constants make it easy to adjust the data volume without hunting through the seed logic.

`SALE_DAYS` — an array of five `Date` objects representing the five days of demo data. Use relative dates so the seed produces relevant data regardless of when it is run. The five days should be: four days ago, three days ago, two days ago, yesterday, and today. Construct each date by creating a new `Date()` object and adjusting `setDate` using `getDate() - N` for each day. Set the time component of each date to `09:00:00` at the start and vary the individual sale times within each day (see Step 4).

`CASHIERS` — an array of two objects, each containing a `userId` field populated by looking up the seeded cashier `User` records' IDs. Fetch these IDs at the start of the seed block using `prisma.user.findFirstOrThrow({ where: { email: "[seeded cashier 1 email]" } })` for each cashier.

`PAYMENT_DISTRIBUTION` — an object with keys `CASH: 12`, `CARD: 6`, `SPLIT: 2`. These values sum to 20 and represent the 60%/30%/10% distribution. The seed will iterate over 20 sales and assign payment methods based on this distribution.

### Step 3: Create the Shifts

Before creating sales, create two `Shift` records — one per cashier — representing the shifts that these demo sales belong to. Each shift covers a span of all five demo days, which is slightly artificial but acceptable for seed data. In production, shifts would be one-per-day-per-cashier; for seed purposes a single spanning shift simplifies the foreign key setup.

Create each shift using `prisma.shift.create`. Set `tenantId` to the demo tenant's id, `cashierId` to each respective cashier's id, `status` to `"CLOSED"` (since these are historical shifts), `openedAt` to the first day at `08:30:00`, `closedAt` to the last day at `20:00:00`, and `openingCashFloat` to a `Decimal` value of `5000.00` for both shifts.

After creating the two `Shift` records, create a `ShiftClosure` record for each. The `ShiftClosure` contains: `shiftId` (the newly created shift's id), `tenantId`, `cashierId`, `closingCashCount` set to a reasonable computed value (opening float plus the sum of all CASH and SPLIT-cash portions for that cashier's sales — an approximate figure is acceptable in seed data), `expectedCashAmount` set to the same approximate value, `varianceAmount` set to `Decimal(0)` (zero variance makes the reports look clean in demos), `closedByUserId` set to the cashier's own id, and `closedAt` matching the shift's `closedAt` timestamp.

### Step 4: Define the Sale Compositions

Declare an array of 20 sale definition objects. Each object specifies: `dayIndex` (0 to 4, mapping to the five days in `SALE_DAYS`), `hourOffset` (an integer between 0 and 10 representing hours offset from 09:00, distributing four sales evenly across each day's working hours), `cashierIndex` (0 or 1, alternating between the two cashiers — cashier 0 handles sales 0, 2, 4, 6, 8, 10, 12, 14, 16, 18; cashier 1 handles sales 1, 3, 5, 7, 9, 11, 13, 15, 17, 19), `paymentMethod` (assigned from the distribution: the first 12 get `"CASH"`, the next 6 get `"CARD"`, the last 2 get `"SPLIT"`), and `lines` (an array of 2 to 5 line item definitions).

Distribute the four sales per day across the hours from 09:00 to 18:00 with approximately even spacing: day indexes 0-4 each have sales at approximately 09:30, 11:45, 14:20, and 17:00. Vary the minutes to avoid artificially identical timestamps.

For the `lines` array, draw from the product variants seeded in SubPhase 02.01. Select a diverse range of items including clothing (dresses, trousers, shirts), accessories, and footwear if those categories exist in the catalog seed. Each line item definition should include: `variantId` (looked up from the seeded variants), `quantity` (between 1 and 3), and `unitPrice` (read from the variant's seeded price — do not hard-code prices; look them up from the database to ensure consistency with the catalog seed).

### Step 5: Execute the Sale Creation Loop

Loop over the 20 sale definition objects. For each sale, perform the following steps inside the loop body.

First, resolve the `saleId` with `cuid()` (import from the `@paralleldrive/cuid2` package or use Prisma's built-in `cuid()` if available) or use `crypto.randomUUID()` if `cuid2` is not available — check which identifier strategy the rest of the seed uses and match it.

Compute the `Sale` financial fields from the line definitions: compute `subTotal` as the sum of ( `quantity` × `unitPrice` ) for each line. Apply no cart-level discount for simplicity (set `cartDiscountPercent` to 0). Set `totalAmount` equal to `subTotal`.

Construct the `createdAt` timestamp using the `dayIndex` to select the correct day from `SALE_DAYS`, then adding the `hourOffset` in hours.

Create the `Sale` record using `prisma.sale.create`. Set all required fields: `tenantId`, `shiftId` (the shift belonging to the correct cashier), `cashierId`, `status: "COMPLETED"`, `paymentMethod`, `subTotal`, `totalAmount`, `cartDiscountPercent: 0`, `completedAt` (same as `createdAt`), `createdAt`, `updatedAt`.

**Important caveat — stock quantity:** Do not call `adjustStock` or any stock deduction service function for each line during seeding. Calling the stock adjustment service for 20 sales (each with 2 to 5 lines, totalling potentially 100 stock deductions) would add significant seed execution time and could interact unexpectedly with the current stock quantities seeded by the catalog seed. Instead, set the `stockQuantity` on each `ProductVariant` directly at the end of the sales seed block using `prisma.productVariant.update` calls, adjusting each variant's stock to a reasonable positive value (e.g., 50 units) that accounts for the demo sales. Document this approach in a clearly visible comment: "NOTE: Seed data bypasses adjustStock service. Stock quantities are set directly after sale creation to avoid race conditions and excessive transaction overhead in seed. This deviates from the production code path — do not replicate this pattern in application code."

After creating the `Sale`, create the `SaleLine` records for each line using `prisma.saleLine.createMany`. Each `SaleLine` requires: `saleId`, `tenantId`, `variantId`, `quantity`, `unitPrice`, `discountPercent: 0`, `lineTotal` (computed as quantity × unitPrice), `productNameSnapshot` (fetched from `ProductVariant.product.name`), and `variantDescriptionSnapshot` (fetched from the variant's description or size/colour composite).

After the `SaleLine` records, create the `Payment` records based on `paymentMethod`. For `CASH` sales: one `Payment` record with `method: "CASH"` and `amount` equal to `totalAmount`. For `CARD` sales: one `Payment` record with `method: "CARD"`, `amount` equal to `totalAmount`, and `cardReferenceNumber` set to a plausible fake reference such as `"AUTO" + String(saleIndex).padStart(6, "0")`. For `SPLIT` sales: two `Payment` records — one `CARD` record with `amount` set to approximately 60% of `totalAmount` (rounded to two decimal places) and a `cardReferenceNumber`, and one `CASH` record with `amount` set to the remaining 40% of `totalAmount`.

### Step 6: Idempotency and Logging

Throughout the seed block, add `console.log` statements reporting progress: "Creating demo shift for cashier [name]...", "Creating sale [N] of 20...", "Setting stock quantities...", "Demo sales seed complete."

After the loop completes, add the stock fix-up block. Fetch the distinct `variantId` values across all created `SaleLine` records and set each variant's `stockQuantity` to 50 using `prisma.productVariant.updateMany` where possible, or individual updates if the variant IDs must be processed one at a time.

After the fix-up, run a sanity assertion: query `prisma.sale.count({ where: { tenantId: demoTenant.id } })` and verify it equals 20. If it does not, log a warning. Query `prisma.payment.count({ where: { sale: { tenantId: demoTenant.id } } })` and verify it equals 22 (20 standard sales × 1 payment each, plus 2 additional payment records for the 2 SPLIT sales = 22). Log the counts for confirmation.

### Step 7: Run and Verify the Seed

Run the seed script by executing `pnpm prisma db seed` from the project root. Observe the console output for any errors. If the script completes successfully, open Prisma Studio (`pnpm prisma studio`) and navigate to the `Sale` table. Confirm:

- 20 records exist for the demo tenant, all with `status: "COMPLETED"`.
- 12 records have `paymentMethod: "CASH"`, 6 have `"CARD"`, and 2 have `"SPLIT"`.
- The `createdAt` timestamps are spread across 5 distinct days with 4 sales per day.
- The `Payment` table has 22 records total (20 + 2 extra for the 2 SPLIT sales) all linked to the correct sales.
- The `SaleLine` table has records with non-empty `productNameSnapshot` and `variantDescriptionSnapshot` fields.

Run `pnpm prisma db seed` a second time to verify idempotency — the console should print "Demo sales already seeded — skipping." and no duplicate records should appear in the database.

---

## Expected Output

- `prisma/seed.ts` extended with a self-contained sales seed block that creates 2 shifts, 2 shift closures, 20 sales, their line items, and their payment records.
- `pnpm prisma db seed` completes without errors on both the first run and subsequent runs.
- The database contains exactly 22 `Payment` records for the demo sales (20 standard + 2 extra SPLIT legs).

---

## Validation

- Run `pnpm prisma db seed` and confirm it exits with code 0.
- Open Prisma Studio and verify the `Sale`, `SaleLine`, `Payment`, `Shift`, and `ShiftClosure` tables contain the expected record counts.
- Load the POS terminal's shift history or sales history page and confirm the demo sales appear with correct dates, amounts, and payment methods.
- Run `pnpm prisma db seed` a second time and confirm no new records are created.
- Confirm that `ProductVariant.stockQuantity` for all seeded variants is a positive number (the fix-up step applied successfully).

---

## Notes

- The stock bypass caveat must be prominently documented in the seed file. Future developers modifying the seed must understand that the stock quantities shown after seeding are hand-set approximations, not the result of running `adjustStock` calculations. The seed comment should direct developers to the `adjustStock` function in `inventory.service.ts` for the authoritative stock deduction logic.
- The fake `cardReferenceNumber` values (`"AUTO000001"`, etc.) are clearly synthetic. In a real environment these would be terminal-issued approval codes. Keeping them in a recognisable pattern helps QA testers immediately identify seed-generated card payments versus real ones in a shared staging database.
- The five-day spread of demo data ensures that any chart or report component in Phase 4 that renders a "sales over time" graph will have meaningful multi-day data to display without requiring the developer to manually complete dozens of sales through the UI.
- Do not seed `ON_HOLD` or `VOIDED` sales in this task. Those statuses will be covered by a separate scenario-specific seed block if needed for Phase 4 reporting tests.
- If the project uses a `Decimal` type wrapper from `decimal.js` for monetary fields in the seed, ensure all monetary values passed to Prisma are `Decimal` instances, not plain JavaScript numbers. Prisma maps `Decimal` schema fields to PostgreSQL `NUMERIC` columns and expects `Decimal` values in the create/update calls.
