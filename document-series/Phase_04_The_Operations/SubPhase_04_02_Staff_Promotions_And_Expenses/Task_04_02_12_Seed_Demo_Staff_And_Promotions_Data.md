# Task 04.02.12 — Seed Demo Staff and Promotions Data

## Metadata

| Field | Value |
|---|---|
| Task ID | 04.02.12 |
| SubPhase | 04.02 — Staff, Promotions and Expenses |
| Complexity | Low |
| Estimated Effort | 1–2 hours |
| Depends On | 04.02.01 (all new models migrated), Phase 01 seed (CASHIER user, Tenant), Phase 03 seed (demo sales and shifts) |
| Produces | Updated prisma/seed.ts with idempotent demo data for all SubPhase 04.02 concepts |
| Owner Role | Full-Stack Developer |

---

## Objective

Extend the Prisma seed script to populate all new SubPhase 04.02 entities with representative demo data. The seed must be idempotent — running it more than once must not create duplicate records. All seeded data must be consistent: commission records must reference real Sale IDs from the Phase 03 seed, promotions must have plausible names and values, and expenses must span multiple categories and dates.

---

## Context

The Phase 01 seed already creates a Tenant, a SUPER_ADMIN, an OWNER, a MANAGER, and a CASHIER. The Phase 03 seed creates demo products, variants, a Shift, and five Sale records. This task builds on those records by assigning a commissionRate to the CASHIER, creating CommissionRecord entries for those demo sales, creating demo Promotions, seeding Expense records across categories, and adding CashMovement records for the demo shift.

---

## Instructions

### Step 1: Update the Seeded CASHIER User

In the seed script, locate the upsert or findFirst call that creates or retrieves the CASHIER user. After the upsert, add an update call that sets commissionRate to 5.00 (representing 5%). Use prisma.user.update targeting the CASHIER's ID. Wrap the update in a conditional that checks whether commissionRate is already set, so re-running the seed does not overwrite a manager's intentional change — use upsert with update: {} if no change is needed.

### Step 2: Seed CommissionRecord Entries

Retrieve the five demo Sale IDs from the Phase 03 seed (or query them by their reference numbers). For each sale that does not already have a CommissionRecord (check by saleId), compute the earnedAmount as the sale's totalAmount multiplied by 0.05. Create a CommissionRecord with isPaid set to false for the first three sales and isPaid set to true for the remaining two (to demonstrate a mixed paid/unpaid state in the UI). Use prisma.commissionRecord.upsert keyed on saleId to ensure idempotency.

### Step 3: Seed Three Demo Promotions

Create the following three Promotion records using upsert keyed on a combination of tenantId and name to prevent duplicates.

The first promotion has name "10% Off Everything", type CART_PERCENTAGE, value 10.00, isActive true, and no time window restrictions — it represents an always-on storewide discount.

The second promotion has name "Summer10", type PROMO_CODE, promoCode "SUMMER10", value 10.00, isActive true, and no time window — it represents a promotional code that cashiers can share with customers.

The third promotion has name "Coffee Accessories Discount", type CATEGORY_PERCENTAGE, value 15.00, targetCategoryId set to the first seeded Category ID from the Phase 02 seed, isActive true — it represents a category-specific discount for demonstration purposes.

### Step 4: Seed Five Demo Expense Records

Create five Expense records distributed across different categories. Use prisma.expense.upsert where possible. If upsert is not straightforward due to the absence of a natural unique key, use a findFirst check on tenantId, description, and expenseDate before creating. The five records are: RENT for 1200.00 on the first day of the current month with description "Monthly retail space rent", UTILITIES for 230.00 on the fifth of the month with description "Electricity and water bill", SALARIES for 3500.00 on the fifteenth with description "Weekly staff wages", ADVERTISING for 150.00 on the tenth with description "Social media promotion boost", and MISCELLANEOUS for 45.00 on the twentieth with description "Office supplies purchase". Set recordedById to the MANAGER user ID for all five records.

### Step 5: Seed Two CashMovement Records

Retrieve the demo Shift from the Phase 03 seed. Create two CashMovement records for that shift using a findFirst check keyed on shiftId and type to prevent duplicates. The first record has type OPENING_FLOAT, amount 200.00, and no reason. The second has type PETTY_CASH_OUT, amount 35.00, reason "Purchased coffee supplies for staff room", and authorizedById set to the MANAGER user ID.

### Step 6: Log Seed Output

At the end of the seed script's SubPhase 04.02 section, add console.log statements reporting what was created. For example, log "Seeded 5 CommissionRecords for CASHIER", "Seeded 3 Promotions", "Seeded 5 Expenses", and "Seeded 2 CashMovements for demo shift." This output helps developers quickly confirm which blocks ran during a seed execution.

---

## Expected Output

- The CASHIER user has commissionRate of 5.00 in the database
- Five CommissionRecord entries exist referencing demo sale IDs, with appropriate isPaid values
- Three Promotion records exist: a CART_PERCENTAGE, a PROMO_CODE with code "SUMMER10", and a CATEGORY_PERCENTAGE
- Five Expense records exist spanning RENT, UTILITIES, SALARIES, ADVERTISING, and MISCELLANEOUS categories
- Two CashMovement records exist for the demo shift
- Running pnpm exec prisma db seed twice produces no duplicate records and exits cleanly

---

## Validation

- Run pnpm exec prisma db seed and confirm the console output lists all seeded entities
- Run the seed a second time — confirm no "Unique constraint failed" errors and the log shows the same entities
- Open Prisma Studio and verify the CommissionRecord, Promotion, Expense, and CashMovement tables contain the expected rows
- Navigate to the commissions reports page and confirm the demo CASHIER appears in the commission summary
- Navigate to the promotions page and confirm all three promotions appear with correct type badges
- Navigate to the expenses page and confirm all five expense categories appear in the expense table and the summary row reflects the correct totals

---

## Notes

- If the Phase 03 seed does not guarantee the same Sale IDs across environments (because it uses cuid), retrieve the sales by their reference number and use the found IDs rather than hardcoded strings. The seed script must be portable across fresh database installations.
- The "SUMMER10" promo code is intentionally left always-active in the seed so developers can immediately test the promo code input on the POS terminal without configuring a time window. In a production onboarding script, promo codes would have defined end dates.
