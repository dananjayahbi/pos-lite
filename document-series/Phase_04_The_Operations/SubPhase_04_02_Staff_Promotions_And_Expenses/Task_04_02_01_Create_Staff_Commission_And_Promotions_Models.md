# Task 04.02.01 — Create Staff Commission and Promotions Models

## Metadata

| Field | Value |
|---|---|
| Task ID | 04.02.01 |
| SubPhase | 04.02 — Staff, Promotions and Expenses |
| Complexity | High |
| Estimated Effort | 2–3 hours |
| Depends On | Phase 01 User model, Phase 03 Sale / Shift / Return models |
| Produces | Migration add_staff_promotions_expenses_models, updated Prisma client |
| Owner Role | Full-Stack Developer |

---

## Objective

Define all new Prisma models, enums, and field additions required by SubPhase 04.02. This single migration provides the data layer for commission tracking, time clocking, promotions, customer pricing rules, expense logging, and cash movement recording. All subsequent tasks in this subphase depend on this task being complete and migrated.

---

## Context

The Phase 03 Sale model already carries salespersonId (nullable FK to User), shiftId (FK to Shift), and subtotal / taxAmount / totalAmount fields. Return and Shift models are also established. This task augments those existing models minimally while introducing seven entirely new ones. All new models carry a tenantId field for multi-tenant row-level isolation, maintaining the pattern established in Phase 01.

---

## Instructions

### Step 1: Declare New Enums

Open prisma/schema.prisma and add three enum declarations. The first is PromotionType with members CART_PERCENTAGE, CART_FIXED, CATEGORY_PERCENTAGE, BOGO, MIX_AND_MATCH, and PROMO_CODE. The second is ExpenseCategory with members RENT, SALARIES, UTILITIES, ADVERTISING, MAINTENANCE, MISCELLANEOUS, and OTHER. The third is CashMovementType with members OPENING_FLOAT, PETTY_CASH_OUT, MANUAL_IN, and MANUAL_OUT. Place these enum blocks after the existing model or enum declarations, maintaining the alphabetical grouping style used in the rest of the schema file.

### Step 2: Extend the User Model

Locate the User model block in schema.prisma. Add commissionRate as a Decimal field marked optional (nullable) with a db attribute of Decimal(5,2). This represents a percentage value such as 5.00 for five percent. Add clockedInAt as a DateTime field marked optional (nullable). Position both new fields in the "operational" section of the User model block, after the existing authentication fields and before any relation fields, to maintain readability. Do not alter any existing fields.

### Step 3: Extend the Sale Model

Locate the Sale model block. Add appliedPromotions as a Json field marked optional (nullable). This field will store an array of applied promotion snapshots serialised at the time of sale completion. Place this field near the other calculated/summary fields such as subtotal and totalAmount.

### Step 4: Define CommissionRecord

Add a new CommissionRecord model with the following fields: id as String using cuid default, tenantId as String, saleId as String referencing Sale.id, userId as String referencing User.id (the salesperson), baseAmount as Decimal representing the sale total after returns, commissionRate as Decimal storing a snapshot of the rate at the time of the record (so historical records are not affected by future rate changes on the User), earnedAmount as Decimal storing the computed commission amount, isPaid as Boolean defaulting to false, and createdAt as DateTime defaulting to now(). Add a relation field to Tenant, Sale, and User. Add a composite index on tenantId and userId and a separate index on saleId.

### Step 5: Define CommissionPayout

Add a CommissionPayout model with: id as String (cuid), tenantId as String, userId as String referencing User.id, periodStart as DateTime, periodEnd as DateTime, totalEarned as Decimal, paidAt as DateTime defaulting to now(), authorizedById as String referencing User.id (the Manager who approved the payout), notes as String marked optional, and createdAt as DateTime defaulting to now(). Add relation fields to Tenant, User (for both userId and authorizedById), and CommissionRecord (as a relation list). Add a composite index on tenantId and userId.

### Step 6: Define TimeClock

Add a TimeClock model with: id as String (cuid), tenantId as String, userId as String referencing User.id, clockedInAt as DateTime, clockedOutAt as DateTime marked optional (null until the user clocks out), shiftId as String marked optional referencing Shift.id (allows linking a time-clock record to a POS shift when opened from the terminal), notes as String marked optional, and createdAt as DateTime defaulting to now(). Add relation fields to Tenant, User, and Shift. Add a composite index on tenantId and userId and an index on shiftId.

### Step 7: Define Promotion

Add a Promotion model with: id as String (cuid), tenantId as String, name as String, type as PromotionType, value as Decimal (the percentage or fixed amount depending on type), promoCode as String marked optional (used only when type is PROMO_CODE), targetCategoryId as String marked optional referencing Category.id (used for CATEGORY_PERCENTAGE type), minQuantity as Int marked optional (used for BOGO and MIX_AND_MATCH types), startsAt as DateTime marked optional, endsAt as DateTime marked optional, isActive as Boolean defaulting to true, description as String marked optional, and createdAt as DateTime defaulting to now(). Add relation fields to Tenant and Category. Add a unique constraint on the combination of tenantId and promoCode (partial — only enforce uniqueness when promoCode is not null, documented in a schema comment). Add an index on tenantId and isActive for efficient active-promotion lookups.

### Step 8: Define CustomerPricingRule

Add a CustomerPricingRule model with: id as String (cuid), tenantId as String, customerTag as String (matched against the Customer.tags string array), variantId as String marked optional referencing ProductVariant.id (null means the rule applies to all variants for matching customers), price as Decimal, startsAt as DateTime marked optional, endsAt as DateTime marked optional, isActive as Boolean defaulting to true, and createdAt as DateTime defaulting to now(). Add relation fields to Tenant and ProductVariant. Add a composite index on tenantId and customerTag, and an index on variantId.

### Step 9: Define Expense

Add an Expense model with: id as String (cuid), tenantId as String, category as ExpenseCategory, amount as Decimal, description as String, receiptImageUrl as String marked optional, recordedById as String referencing User.id, expenseDate as DateTime (store as Date at midnight UTC — documented in a schema comment), and createdAt as DateTime defaulting to now(). Add relation fields to Tenant and User. Add a composite index on tenantId and expenseDate for date-range queries.

### Step 10: Define CashMovement

Add a CashMovement model with: id as String (cuid), tenantId as String, shiftId as String referencing Shift.id, type as CashMovementType, amount as Decimal (always positive — type determines the direction), reason as String marked optional, authorizedById as String marked optional referencing User.id, and createdAt as DateTime defaulting to now(). Add relation fields to Tenant, Shift, and User. Add a composite index on tenantId and shiftId.

### Step 11: Add Back-Relation Fields to Existing Models

Add a timeClocks relation list to the User model pointing to TimeClock. Add a commissionRecords relation list and a commissionPayouts relation list to the User model. Add a cashMovements relation list to the Shift model. Add a commissionRecord relation (singular optional) to the Sale model. These back-relation fields ensure Prisma type generation reflects the full bidirectional graph.

### Step 12: Run the Migration

In the terminal, run the Prisma migration command with the name add_staff_promotions_expenses_models. Use pnpm exec prisma migrate dev followed by --name add_staff_promotions_expenses_models. Confirm that the migration SQL file is generated in prisma/migrations. After migration, run pnpm exec prisma generate to update the Prisma client type definitions. Verify that the TypeScript compiler reports no type errors in the schema-adjacent files.

---

## Expected Output

- prisma/schema.prisma contains all seven new model blocks, three new enum definitions, and the new fields on User and Sale
- A timestamped migration folder under prisma/migrations containing migration.sql with all CREATE TABLE and ALTER TABLE statements
- An updated Prisma client in node_modules/.prisma/client reflecting the new models
- Zero TypeScript compilation errors related to the new schema

---

## Validation

- Run pnpm exec prisma migrate status and confirm the migration is listed as Applied
- Confirm CommissionRecord, CommissionPayout, TimeClock, Promotion, CustomerPricingRule, Expense, and CashMovement tables exist in the PostgreSQL database using a database client or Prisma Studio
- Confirm User table has commissionRate and clockedInAt columns
- Confirm Sale table has appliedPromotions column of type jsonb
- Confirm PromotionType, ExpenseCategory, and CashMovementType PostgreSQL enum types exist via SELECT typname FROM pg_type WHERE typtype = 'e'

---

## Notes

- The promoCode uniqueness per tenant cannot be expressed as a standard Prisma unique constraint because promoCode is nullable. Document this constraint in a schema comment and enforce it at the application layer in the Promotion service (task 04.02.07).
- Decimal precision for commissionRate is (5,2), supporting values from 0.00 to 999.99 — this range accommodates edge cases such as 100.00 percent referral bonuses without overflow.
- All Decimal fields for monetary amounts use the default Prisma Decimal type, which maps to PostgreSQL NUMERIC and avoids floating-point precision errors. Ensure the Prisma client Decimal import is used in all service files, not JavaScript's native number type.
