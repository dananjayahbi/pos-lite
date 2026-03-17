# Task 02.03.12 — Seed Stock Levels For Sample Catalog

## Metadata

| Field | Value |
|---|---|
| Task ID | 02.03.12 |
| Task Name | Seed Stock Levels For Sample Catalog |
| Parent Sub-Phase | SubPhase_02_03 — Advanced Stock Control |
| Complexity | Low |
| Dependencies | Task_02_01_12 complete |
| Output Path | prisma/seed.ts (modified) |

---

## Objective

Extend the Prisma seed script to add INITIAL_STOCK StockMovement records for every ProductVariant in the sample catalog seeded by Task_02_01_12. The existing seed sets stockQuantity values directly on ProductVariant records, but without corresponding StockMovement records, the movement history appears empty for all seeded variants. This task ensures the development environment has realistic movement history from day zero, enabling meaningful testing of the Stock Movement History page, the Low Stock Alert widget, and the stock valuation view.

---

## Instructions

### Step 1: Review the Existing Seed Structure

Open prisma/seed.ts and read the section added by Task_02_01_12. Understand how the 30 sample products and their variants were created. Note the stockQuantity values assigned to each variant. Some variants were intentionally seeded with stock below their lowStockThreshold — identify the proportion and specific variants involved, as these will be important for validating the Low Stock Alert widget afterwards.

Identify the system actor for seed operations. The seed should use the SUPER_ADMIN user created in SubPhase_01_02_12 as the actorId for all INITIAL_STOCK movements. Find where this user is created or resolved in the seed script and store the reference for use later in this seed extension.

### Step 2: Design the Idempotency Strategy

A critical requirement is that running the seed twice must not create duplicate INITIAL_STOCK movements. Design the idempotency check before writing any seed logic.

The safest idempotency check is: for each ProductVariant with stockQuantity greater than zero, query whether any StockMovement record already exists for that variantId with reason INITIAL_STOCK and actorId equal to the SUPER_ADMIN seed user's ID. If such a record already exists, skip creating another one.

An alternative strategy is checking whether any StockMovement record exists at all for the variant (not just INITIAL_STOCK). The stricter approach is checking specifically for reason INITIAL_STOCK from the seed actor, as this avoids skipping legitimate manual adjustments made after seeding.

Implement the per-variant INITIAL_STOCK check: fetch all variant IDs for the dev tenant that have stockQuantity greater than zero, then perform a single Prisma query to find which of these variants already have a StockMovement record with reason INITIAL_STOCK and the seed actorId. Subtract the already-seeded set from the full set to get the variants that still need INITIAL_STOCK records.

### Step 3: Create the INITIAL_STOCK Movements in Batch

For each variant in the "needs seeding" set, create a StockMovement record with these field values:

The variantId is the current variant's ID.

The tenantId is the dev tenant's ID.

The actorId is the SUPER_ADMIN seed user's ID.

The reason is INITIAL_STOCK.

The quantityBefore is zero, representing that no stock existed before the initial entry.

The quantityAfter is the variant's current stockQuantity.

The quantityDelta is identical to quantityAfter (since quantityBefore is zero, the delta equals the full quantity).

The note field is the string "Initial stock seeded for development environment."

The createdAt can be set to a plausible historical timestamp — use a date approximately 30 days before the current seed date, for example the first day of the preceding month. Using a historical timestamp makes the movement history look realistic (the store received its initial stock a month ago) rather than having all INITIAL_STOCK entries at the exact same timestamp as the seed run. Vary the timestamp slightly across variants — offset each by one or two hours — to simulate a realistic receiving process over the course of a day.

Use Prisma createMany to insert all movements in a single database operation for efficiency. The createMany call should include skipDuplicates: false since the idempotency check in Step 2 already filtered the list.

### Step 4: Handle Zero-Stock Variants

Variants with stockQuantity of zero should not receive an INITIAL_STOCK movement record. It would be semantically incorrect to record an "initial stock of 0 units" — an INITIAL_STOCK movement signifies receiving stock, and zero units was never received. Zero-stock variants simply have no movement history at seed time. This is a valid state: they appear in the catalog but have no available stock.

If the seed data includes variants where stockQuantity is zero but lowStockThreshold is also zero (no threshold configured), these should also be excluded from any low stock alert verification steps. Only variants with stockQuantity greater than zero and stockQuantity less than or equal to a positive lowStockThreshold are valid low-stock candidates.

### Step 5: Add a Seed Summary Log

At the end of the seed extension, log a clear summary to the console. The summary should state: the total number of ProductVariants in the tenant, how many had stockQuantity greater than zero, how many INITIAL_STOCK movements were created in this run, and how many were skipped (already existed). This information helps developers confirm the seed ran correctly without needing to query the database manually.

Example summary output (as plain text in the console): "Stock seeding complete: 87 variants total, 74 with stock > 0, 74 INITIAL_STOCK movements created, 0 skipped."

On a second run (idempotency test): "Stock seeding complete: 87 variants total, 74 with stock > 0, 0 INITIAL_STOCK movements created, 74 skipped."

### Step 6: Verify the Low-Stock Seed Subset

After the seed runs, verify the correctness of the low-stock signal. Review the Task_02_01_12 seed data to confirm that a specific subset of variants (approximately 15% of the total, as specified in that task) were seeded with stockQuantity at or below their lowStockThreshold. Run the seed and then check the GET /api/stock/low-stock endpoint. The count returned must match the expected number of at-or-below-threshold variants.

This verification step is not automated in the seed script — it is a manual validation step described in developer instructions. Document the expected low-stock count in the seed file as a comment so developers can quickly cross-check after running the seed.

### Step 7: Verify Stock Valuation Totals

After seeding, the Stock Valuation page should show non-zero values matching the seed data. As a verification guide, document in the seed script (as a comment near the seeding logic) the expected total retail value calculated from the seed's defined stockQuantity and retailPrice values. This figure allows a developer to open the Stock Valuation page and immediately confirm the displayed value is correct without performing the calculation manually from scratch.

The expected total retail value is computed as the sum of (variant.stockQuantity × variant.retailPrice) for all seeded variants with stockQuantity greater than zero. Similarly document the expected cost value and the resulting margin percentage.

### Step 8: Test Seed Idempotency Explicitly

After implementing, run the seed script twice in sequence using pnpm prisma db seed and verify the second run produces the "0 movements created, N skipped" summary log. This is the final confirmation that the idempotency logic works correctly.

Also verify that running the full prisma migrate reset (which drops and recreates the database and re-runs all seeds) produces the correct number of INITIAL_STOCK movements from a clean start.

---

## Expected Output

A modified prisma/seed.ts that creates INITIAL_STOCK StockMovement records for all seeded variants with positive stock. The seed is idempotent and logs a clear summary. After seeding, the Stock Movement History page shows entries dated approximately 30 days ago, the Low Stock Alert widget correctly flags the expected number of at-risk variants, and the Stock Valuation page shows totals matching the documented expected values.

---

## Validation

- Run pnpm prisma db seed from a clean database. Confirm the console output shows the correct counts of INITIAL_STOCK movements created.
- Run the seed a second time without resetting the database. Confirm all movements are skipped (none created again).
- Navigate to /dashboard/dev-store/stock-control/movements. Confirm INITIAL_STOCK entries appear dated approximately 30 days ago with the correct actor (SUPER_ADMIN).
- Navigate to /dashboard/dev-store/stock-control/low-stock. Confirm the variant count matches the expected low-stock subset defined in Task_02_01_12.
- Navigate to /dashboard/dev-store/stock-control/valuation. Confirm the Total Retail Value matches the expected figure documented in the seed script.
- Run pnpm prisma migrate reset. Confirm the full seed (including stock movements) runs from scratch without errors.

---

## Notes

- The staggered historical timestamps are important for a realistic demo. If every INITIAL_STOCK movement has the exact same createdAt, the movement history table looks artificial. Spread them across a plausible receiving day.
- The seed should under no circumstances create duplicate INITIAL_STOCK records. Test the idempotency check carefully — a missing or incorrect check could lead to doubled stock quantities appearing in valuation calculations if the movement history is ever replayed.
- The comment in the seed file documenting expected totals (Step 7) is a developer convenience, not a runtime assertion. Do not add runtime assertions in the seed script that would cause it to fail — seed scripts should always complete gracefully even if the expected values drift due to intentional seed data changes.
