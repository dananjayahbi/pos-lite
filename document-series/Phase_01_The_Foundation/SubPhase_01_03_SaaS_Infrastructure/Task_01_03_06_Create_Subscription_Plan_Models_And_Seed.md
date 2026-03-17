# Task 01.03.06 — Create Subscription Plan Models And Seed

## Metadata

- **Sub-Phase:** 01.03 — SaaS Infrastructure & Tenant Management
- **Phase:** 01 — The Foundation
- **Estimated Complexity:** Low
- **Dependencies:** Task_01_03_01 (Plan model created and migrated)

## Objective

Update prisma/seed.ts to seed the two initial VelvetPOS subscription plans — Basic POS and Pro POS + WhatsApp — using an idempotent upsert strategy so the seeder can be run multiple times without creating duplicate records.

## Instructions

### Step 1: Open the Seed File

Open prisma/seed.ts. This file already contains the Super Admin seeding logic from Task 01.02.12. The plan seeding code should be added as a dedicated function — name it seedPlans — called from the main seed function early in the execution sequence, before any tenant or user seeding that depends on plans existing.

### Step 2: Define the Basic POS Plan Data

Inside the seedPlans function, declare the data for the first plan. The plan name is "Basic POS". The description is "The essential toolkit for a modern clothing boutique". The priceMonthly value is 4999 represented as a numeric value matching the Prisma Decimal field. The features array contains five strings in this order: "POS Terminal", "Inventory Management", "Sales History", "Basic Reports", and "Up to 3 Staff Accounts". The isActive value is true. The sortOrder value is 1.

### Step 3: Define the Pro POS + WhatsApp Plan Data

Declare the second plan's data. The name is "Pro POS + WhatsApp". The description is "Full-featured POS with WhatsApp marketing and priority support". The priceMonthly value is 7999. The features array contains six strings: "Everything in Basic POS", "WhatsApp Receipt Delivery", "WhatsApp Marketing Broadcasts", "Advanced Reports & Analytics", "Unlimited Staff Accounts", and "Priority Support". The isActive value is true. The sortOrder value is 2.

### Step 4: Implement Idempotent Upsert Logic

For each plan, use the Prisma upsert method with the plan's name as the unique identifier in the where clause. In the create block, provide the full plan data. In the update block, update only the priceMonthly, features, isActive, and sortOrder fields — this allows the seeder to update pricing and features in the development database without needing to drop and recreate the record. Do not update the name or description fields in the update block to avoid accidentally overwriting customised production-like data.

### Step 5: Add Seed Logging

After each upsert call, log a message to the console indicating what happened. Because Prisma's upsert does not natively return whether it performed a create or an update, use a separate findUnique call before the upsert to check if the record already existed. If findUnique returns null, log "Created plan: [plan name]". If it returns a record, log "Plan already exists, updated fields: [plan name]". This approach gives the developer running the seed a clear picture of what changed.

### Step 6: Call seedPlans From the Main Function

In the main seed function, call await seedPlans() before any other seeding operations, since plans are referenced by Subscriptions created in later seed steps. Wrap the entire seedPlans function in a try/catch block so a failure during plan seeding outputs a helpful error message rather than a silent crash.

### Step 7: Run the Seeder and Verify

Run the seeder using pnpm prisma db seed. The terminal output should show one "Created plan" message for each of the two plans on first run. On a second run of the same command, the terminal output should show two "Plan already exists, updated fields" messages, confirming idempotence. After seeding, open Prisma Studio by running pnpm prisma studio and navigate to the Plan table. Confirm that exactly two rows exist, that the priceMonthly values match 4999 and 7999 respectively, and that the features column contains a valid JSON array for each plan.

### Step 8: Update the Plan-Related API Route

Ensure that the GET handler at src/app/api/superadmin/plans/route.ts (created or referenced during the provisioning wizard task) queries plans with isActive equal to true, ordered by sortOrder ascending. After the seed, visiting this endpoint while authenticated as SUPER_ADMIN should return a JSON array containing both plan objects in the correct order.

## Expected Output

- prisma/seed.ts contains a seedPlans function with two upsert operations
- Running pnpm prisma db seed creates both plans on a fresh database and updates them on subsequent runs
- The Prisma Studio Plan table shows two records with correct names, prices, and feature arrays
- The seedPlans function logs meaningful output for both create and update scenarios

## Validation

- [ ] prisma/seed.ts contains the seedPlans function called from the main seed function
- [ ] Running pnpm prisma db seed completes without errors
- [ ] On first run, the console shows "Created plan: Basic POS" and "Created plan: Pro POS + WhatsApp"
- [ ] On a second run, the console shows the "already exists" messages for both plans
- [ ] Prisma Studio Plan table shows exactly two records after seeding
- [ ] The Basic POS record has priceMonthly of 4999 and five feature strings
- [ ] The Pro POS + WhatsApp record has priceMonthly of 7999 and six feature strings
- [ ] GET /api/superadmin/plans returns both plans ordered by sortOrder

## Notes

The Decimal type in Prisma maps to a JavaScript string when read from the database to preserve precision. When passing the priceMonthly value to seed functions, provide the number as a JavaScript numeric value or as a string — both are accepted by the Prisma Decimal input type. When formatting the price for display in the UI, always format it using Intl.NumberFormat with the LKR locale and currency option to ensure correct thousands separators and currency symbol placement for Sri Lankan Rupees.
