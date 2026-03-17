# Task 01.03.12 — Seed Initial Tenant And Plans

## Metadata

- **Sub-Phase:** 01.03 — SaaS Infrastructure & Tenant Management
- **Phase:** 01 — The Foundation
- **Estimated Complexity:** Low
- **Dependencies:** Task_01_03_06 (Plan seeding logic in place), Task_01_02_12 (Super Admin seed in place)

## Objective

Complete prisma/seed.ts to conditionally create a sample development tenant named "Dilani Boutique" with an OWNER user account and an ACTIVE subscription, gated behind a SEED_SAMPLE_TENANT environment variable so the sample data is never accidentally introduced into production environments.

## Instructions

### Step 1: Review the Current Seed File Structure

Open prisma/seed.ts. By this point the file contains a main function calling two existing seed blocks: the Super Admin account seeder from Task 01.02.12 and the subscription plans seeder from Task 01.03.06. Add the sample tenant seeder as a third block, also called from main, after the plans seeder completes — the tenant seeder depends on plan records existing, so call order matters.

### Step 2: Create the seedSampleTenant Function

Define a new async function named seedSampleTenant. Its first action is to read the SEED_SAMPLE_TENANT environment variable. If the variable is not set to the exact string "true", the function logs the message "Skipping sample tenant seed (SEED_SAMPLE_TENANT is not set to 'true')" and returns immediately without performing any database operations. This guard prevents any test or production seeder run from accidentally creating the development tenant.

### Step 3: Check for Existing Sample Tenant

Inside the guard, before performing any creates, use Prisma findFirst to check whether a Tenant record with slug equal to "dilani" already exists (regardless of soft-delete status to prevent ghost record accumulation). If a record is found, log "Sample tenant already exists, skipping" and return without attempting a create. This makes the function idempotent.

### Step 4: Resolve the Pro Plan ID

Look up the Pro POS + WhatsApp Plan record by querying Prisma with findFirst where name equals "Pro POS + WhatsApp". If this query returns null, throw an error with the message "Pro plan not found — ensure plans are seeded before running tenant seed". Store the plan's id for use in the Subscription creation step.

### Step 5: Read Owner Credentials From Environment

Read the sample owner's email from the environment variable SEED_OWNER_EMAIL and the plain-text password from SEED_OWNER_PASSWORD. If either is missing, throw an error instructing the developer to add both to their .env.local file. Hash the plain-text password using bcrypt with 12 salt rounds. Store the resulting hash for the User creation step. Never log the plain-text password anywhere.

### Step 6: Create the Tenant Record

Use Prisma create to insert the Tenant record with the following values: name set to "Dilani Boutique", slug set to "dilani", status set to ACTIVE, logoUrl set to null, graceEndsAt set to null, customDomain set to null, settings as a JSON object with currency "LKR", timezone "Asia/Colombo", vatRate 18, ssclRate 2.5, and receiptFooter "Thank you for shopping at Dilani Boutique!". Both createdAt and updatedAt default automatically via Prisma. Store the returned tenant object for the subsequent steps.

### Step 7: Create the OWNER User Record

Use Prisma create to insert an OWNER User record. The email is the value read from SEED_OWNER_EMAIL. The passwordHash is the bcrypt hash computed in Step 5. The role is OWNER. The tenantId is the tenant's id from Step 6. The name can be set to "Store Owner" as a placeholder. Log the message "Created OWNER user: [email]" after completion.

### Step 8: Create the ACTIVE Subscription Record

Use Prisma create to insert a Subscription record with the following values: tenantId set to the new tenant's id, planId set to the Pro plan's id from Step 4, status set to ACTIVE, currentPeriodStart set to new Date() (today), currentPeriodEnd set to a new Date calculated as today plus 30 days, nextBillingDate set to that same 30-days-from-now date, payhereSubId set to null, and cancelledAt set to null. Log the message "Created ACTIVE subscription for Dilani Boutique on Pro POS + WhatsApp plan."

### Step 9: Wrap in a Prisma Transaction

Wrap the three create operations (Tenant, User, and Subscription) in a Prisma transaction using prisma.$transaction as an array transaction. If any one of the operations fails, all three are rolled back atomically so no partially-created tenant state is left in the database.

### Step 10: Run and Verify the Full Seeder

Run pnpm prisma db seed with SEED_SAMPLE_TENANT=true set in the environment (either via the .env.local file or as an inline variable prefix in the terminal command). The expected terminal output is: the Super Admin confirmation message, the two plan confirmation messages, and then the three new lines for the tenant, user, and subscription. On a second run, all blocks should output their "already exists" messages without creating duplicate records. After seeding, open Prisma Studio and confirm: one "Dilani Boutique" row in the Tenant table, one OWNER User row with the seeded email, and one ACTIVE Subscription row linked to the Pro plan.

### Step 11: Document Seeder Usage in the README

Open README.md in the project root and add a "Seeding" section documenting the full seeder command with the SEED_SAMPLE_TENANT flag, the required environment variables (SEED_OWNER_EMAIL, SEED_OWNER_PASSWORD), and the expected console output. This documentation ensures future developers on the team can reproduce the development database state without guesswork.

## Expected Output

- prisma/seed.ts contains the seedSampleTenant function called conditionally from main
- Running pnpm prisma db seed without SEED_SAMPLE_TENANT=true skips sample tenant creation
- Running pnpm prisma db seed with SEED_SAMPLE_TENANT=true creates the Dilani Boutique tenant, its OWNER user, and its ACTIVE subscription in a single transaction
- All seed operations are idempotent — running the seeder any number of times results in exactly one record per seeded entity
- README.md documents the seeder usage and environment variable requirements

## Validation

- [ ] seedSampleTenant is defined and called from the main seed function
- [ ] Running the seeder without SEED_SAMPLE_TENANT=true produces the skip log message and creates no tenant records
- [ ] Running the seeder with SEED_SAMPLE_TENANT=true creates one Tenant, one User, and one Subscription
- [ ] The Tenant record has slug "dilani", status ACTIVE, and correct settings JSON
- [ ] The User record has role OWNER, is linked to the "dilani" tenant, and has a bcrypt-hashed password
- [ ] The Subscription record has status ACTIVE, is linked to the Pro POS + WhatsApp plan, and has correct period dates
- [ ] Running the seeder a second time with the flag set produces "already exists" output and no duplicate records
- [ ] pnpm tsc --noEmit passes with no errors in prisma/seed.ts

## Notes

The SEED_OWNER_PASSWORD value used in development must never be reused in any production environment. Add explicit comments in seed.ts and in the .env.example file reinforcing that SEED_OWNER_PASSWORD is strictly a local development credential. When Phase 4 introduces the staff onboarding flow, the store owner's password change on first login will be enforced — but for now, the seeded password is retained as-is for developer convenience.
