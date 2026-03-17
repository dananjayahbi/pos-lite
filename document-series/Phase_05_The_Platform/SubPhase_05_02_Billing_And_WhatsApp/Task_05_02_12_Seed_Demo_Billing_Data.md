# Task 05.02.12 — Seed Demo Billing Data

## Metadata

| Property | Value |
|---|---|
| Task ID | 05.02.12 |
| SubPhase | 05.02 — Billing and WhatsApp Automation |
| Complexity | Medium |
| Depends On | 05.02.01 |
| Primary Files | prisma/seed.ts |
| Roles Involved | Development / QA |

## Objective

Extend the Prisma seed script to populate billing-specific demo data: three SubscriptionPlan records (STARTER, GROWTH, ENTERPRISE), an ACTIVE GROWTH subscription for the primary demo tenant, three demo invoices (two PAID, one PENDING), two PaymentReminder records, and two additional lite demo tenants (one TRIAL, one SUSPENDED) to make the Super Admin MRR dashboard meaningful during development and QA.

## Instructions

### Step 1: Add Idempotency Guards

At the beginning of the billing seed section in prisma/seed.ts, add idempotency checks using upsert or findFirst-or-create patterns:
- For SubscriptionPlan records, use upsert with where: { name: "STARTER" } (and similarly for GROWTH and ENTERPRISE). This prevents duplicate plans on repeated seed runs.
- For Invoice records, use upsert with where: { invoiceNumber: "INV-2025-0001" } (and for 0002, 0003). Never hardcode invoice numbers that could conflict with production-generated numbers in a shared staging database. Consider using a "INV-SEED-" prefix (e.g., "INV-SEED-0001") for seed records if staging and production share a database.
- For the additional lite tenants, upsert using a unique email for the owner user.

Import Decimal from "decimal.js" at the top of the seed file if not already imported. Import all date-fns helpers needed: startOfMonth, endOfMonth, subMonths, addMonths, addDays, subDays.

### Step 2: Create the Three Subscription Plans

Upsert three SubscriptionPlan records in sequence:

**STARTER plan**: name "STARTER", monthlyPrice Decimal("1500.00"), annualPrice Decimal("15000.00") (equivalent to 2 months free), maxUsers 3, maxProductVariants 200, features array containing "pos:basic", "reports:basic", "stock:basic", isActive true.

**GROWTH plan**: name "GROWTH", monthlyPrice Decimal("3500.00"), annualPrice Decimal("35000.00"), maxUsers 10, maxProductVariants 1000, features array containing "pos:basic", "pos:returns", "reports:advanced", "stock:advanced", "crm:basic", "whatsapp:basic", isActive true.

**ENTERPRISE plan**: name "ENTERPRISE", monthlyPrice Decimal("8000.00"), annualPrice Decimal("80000.00"), maxUsers 50, maxProductVariants 5000, features array containing "pos:basic", "pos:returns", "reports:advanced", "reports:export", "stock:advanced", "crm:advanced", "whatsapp:advanced", "staff:unlimited", "hardware:all", isActive true.

Log each upsert result: "Plan upserted: [name] — LKR [monthlyPrice]/mo".

### Step 3: Assign the Demo Tenant an ACTIVE GROWTH Subscription

Fetch the primary demo tenant by slug or by the known email of the demo OWNER user (whichever identifier was used in SubPhase 05.01's seed). Fetch the GROWTH plan by name. 

Upsert the Subscription record using where: { tenantId: demoTenant.id }. Set: planId to growthPlan.id, status to ACTIVE, currentPeriodStart to startOfMonth(new Date()), currentPeriodEnd to endOfMonth(new Date()), createdAt to subMonths(new Date(), 6) (six months ago — represents an established customer). Also update the demo Tenant record: set subscriptionStatus to ACTIVE using prisma.tenant.update.

### Step 4: Create the Three Demo Invoice Records

Create three Invoice records for the primary demo tenant. Use upsert on invoiceNumber to achieve idempotency. All amounts use Decimal("3500.00").

**Invoice 1 (oldest, fully paid)**: invoiceNumber "INV-2025-0001" (or "INV-SEED-0001"), billingPeriodStart = startOfMonth(subMonths(now, 4)), billingPeriodEnd = endOfMonth(subMonths(now, 4)), dueDate = endOfMonth(subMonths(now, 4)), status PAID, paidAt = addDays(startOfMonth(subMonths(now, 4)), 1), payhereOrderId = "PAYHERE-DEMO-001".

**Invoice 2 (recent, paid)**: invoiceNumber "INV-2025-0002" (or "INV-SEED-0002"), billingPeriodStart = startOfMonth(subMonths(now, 2)), billingPeriodEnd = endOfMonth(subMonths(now, 2)), dueDate = endOfMonth(subMonths(now, 2)), status PAID, paidAt = addDays(startOfMonth(subMonths(now, 2)), 2), payhereOrderId = "PAYHERE-DEMO-002".

**Invoice 3 (current month, pending)**: invoiceNumber "INV-2025-0003" (or "INV-SEED-0003"), billingPeriodStart = startOfMonth(now), billingPeriodEnd = endOfMonth(now), dueDate = endOfMonth(now), status PENDING.

All invoices reference the demo tenant's subscriptionId (fetched from the upserted Subscription in Step 3). Set tenantId and subscriptionId on each.

### Step 5: Add Two Demo PaymentReminder Records

Create two PaymentReminder records linked to Invoice 3 (the PENDING invoice):

**Reminder 1**: type THREE_DAY_REMINDER, channel WHATSAPP, sentAt = subDays(new Date(), 2) (two days ago — simulating a reminder sent when the invoice was 3 days before due), status SENT, tenantId = demoTenant.id, invoiceId = invoice3.id.

**Reminder 2**: type DUE_DATE_REMINDER, channel WHATSAPP, sentAt = new Date() (today — simulating the due-date reminder firing on current run), status SENT. Only create this reminder if today is the invoice due date or later (to keep the seed data realistic). For simplicity in the seed, hardcode sentAt to today regardless.

Use upsert or a findFirst guard on the combination of invoiceId and type to maintain idempotency.

### Step 6: Create the Trial Demo Tenant

Create a second demo tenant with minimal data. This tenant exists only for the Super Admin MRR dashboard display and does not have full product/staff seed data.

Create a User record: email "demo-trial-owner@velvetpos.dev", name "Trial Demo Owner", role OWNER, password a hashed placeholder (use bcrypt with a known string like "demo1234" — run this hash at seed time using bcrypt.hashSync(...)). The user must be associated with the new tenant.

Create the Tenant record: name "Trial Demo Boutique", slug "trial-demo", subscriptionStatus TRIAL. Create the Subscription record: planId = starterId, status TRIAL, trialEndsAt = addDays(now, 14), currentPeriodStart = now, currentPeriodEnd = addDays(now, 14). Use upsert on tenant slug for idempotency.

### Step 7: Create the Suspended Demo Tenant

Create a third demo tenant: User email "demo-suspended-owner@velvetpos.dev", name "Suspended Demo Owner", role OWNER. Tenant name "Suspended Demo Boutique", slug "suspended-demo", subscriptionStatus SUSPENDED. Subscription: planId = growthPlan.id, status SUSPENDED, currentPeriodStart = startOfMonth(subMonths(now, 2)), currentPeriodEnd = endOfMonth(subMonths(now, 1)) (past the grace period — current period ended last month), cancelledAt null (it was suspended, not cancelled).

Use upsert on tenant slug for idempotency.

### Step 8: Log the Seed Summary

At the end of the billing seed section, log a completion message to the console: "Billing seed complete — Plans: 3 (STARTER, GROWTH, ENTERPRISE) | Primary demo tenant: ACTIVE GROWTH | Demo invoices: 3 (2 PAID, 1 PENDING) | Payment reminders: 2 | Additional demo tenants: Trial Demo Boutique (TRIAL, 14 days), Suspended Demo Boutique (SUSPENDED)."

## Expected Output

- Three SubscriptionPlan records: STARTER LKR 1,500/mo, GROWTH LKR 3,500/mo, ENTERPRISE LKR 8,000/mo
- Primary demo tenant with ACTIVE Subscription on GROWTH plan
- Three Invoice records: INV-2025-0001 (PAID), INV-2025-0002 (PAID), INV-2025-0003 (PENDING)
- Two PaymentReminder records for the PENDING invoice
- Trial Demo Boutique tenant: TRIAL, STARTER, 14 days remaining
- Suspended Demo Boutique tenant: SUSPENDED, GROWTH, past grace period

## Validation

- [ ] pnpm prisma db seed runs to completion without errors or unhandled promise rejections
- [ ] Re-running the seed command produces no duplicate records (idempotency confirmed)
- [ ] Primary demo tenant has subscriptionStatus ACTIVE in the database
- [ ] All three invoices exist: correct invoiceNumbers, statuses, and amounts
- [ ] Invoice 1 and Invoice 2 have non-null paidAt values
- [ ] Invoice 3 has null paidAt and status PENDING
- [ ] Two PaymentReminder records exist for Invoice 3: one THREE_DAY_REMINDER, one DUE_DATE_REMINDER
- [ ] Trial Demo Boutique has subscriptionStatus TRIAL and trialEndsAt approximately 14 days from seed run date
- [ ] Suspended Demo Boutique has subscriptionStatus SUSPENDED
- [ ] The MRR dashboard at /dashboard/super-admin/metrics shows non-zero MRR and at least 1 active subscriber after seeding
- [ ] Decimal amounts are stored with exact precision (LKR 3500.00, not 3499.9999...)

## Notes

- The invoice numbers "INV-2025-0001" through "INV-2025-0003" are hardcoded only for the seed. The production generateInvoiceNumber function counts real invoices for the current year and assigns the next sequential number. These hardcoded seed numbers may conflict with production counts if the seed is run against a database that already has production invoices. Use the prefix "INV-SEED-" in shared staging environments to avoid collisions.
- The placeholder passwords ("demo1234" hashed with bcrypt) created for the demo tenant owners must never be deployed to production. The seed file should check for a NODE_ENV guard and refuse to run if NODE_ENV equals "production".
- The date-fns functions (startOfMonth, subMonths, addDays) must be imported at the top of seed.ts. These ensure seed dates remain consistent relative to the run date rather than hardcoded calendar dates that become stale over time.
