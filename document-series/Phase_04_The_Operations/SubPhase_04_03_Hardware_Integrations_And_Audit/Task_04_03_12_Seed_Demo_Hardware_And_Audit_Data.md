# Task 04.03.12 — Seed Demo Hardware and Audit Data

## Metadata

| Field | Value |
|---|---|
| Task ID | 04.03.12 |
| Task Name | Seed Demo Hardware and Audit Data |
| SubPhase | 04.03 — Hardware Integrations and Audit |
| Priority | Low |
| Complexity | Low |
| Estimated Effort | 1 hour |
| Depends On | All prior tasks in SubPhase 04.03 (AuditLog model, Customer.lastBirthdayMessageSentYear field, CashMovement model) |
| Produces | Updated prisma/seed.ts with hardware config, AuditLog entries, CashMovement records, and customer field updates |

## Objective

Extend the seed script to populate realistic demo data for SubPhase 04.03 features: a printer hardware configuration on the demo tenant, ten varied AuditLog entries covering multiple entity types and actors, two CashMovement records on a demo shift, and the lastBirthdayMessageSentYear field set to null for all existing demo customers. All additions must be idempotent.

## Instructions

### Step 1: Locate the Seed Script

Open prisma/seed.ts. Identify the section that upserts the demo Tenant record established in earlier SubPhases. The tenant upsert uses the demo tenant's id or slug as the unique identifier.

### Step 2: Add Hardware Configuration to the Demo Tenant

In the tenant upsert or update call, merge a hardware sub-object into the tenant's settings JSON field. Use a pattern that reads the existing settings, spreads them, and sets the hardware key. The hardware object should be:

- type: "NETWORK"
- host: "192.168.1.100"
- port: 9100
- cashDrawerEnabled: true
- cfdEnabled: true
- paperWidth: "80mm"

Use Prisma's JSON merge update — read the current tenant record, spread the existing settings into a new object, and set hardware to the values above. Then call prisma.tenant.update with the merged settings. Add a console.log line after the update: "Seeded hardware config for demo tenant."

### Step 3: Seed AuditLog Entries

Before inserting AuditLog entries, check whether any AuditLog records already exist for the demo tenant using prisma.auditLog.count. If count is greater than zero, skip the AuditLog seeding block entirely and log "AuditLog entries already seeded — skipping." This is the idempotency guard.

If count is zero, create ten AuditLog records using prisma.auditLog.createMany. Each record should have the demo tenant's id as tenantId and reference one of the demo users (mix of OWNER role user and CASHIER role user from earlier seed data) as userId. The ten records should cover a variety of entity types, action values, and timestamps spread across the last 14 days. Define them with the following distribution:

- Two records with entityType "Sale": one with action "SALE_COMPLETED" and one with action "SALE_VOIDED"
- Two records with entityType "Return": both with action "RETURN_COMPLETED"
- Two records with entityType "Customer": one with action "CUSTOMER_CREDIT_ADJUSTED" showing previousValues { creditBalance: 0 } and newValues { creditBalance: 50 }, and one with action "STAFF_ROLE_CHANGED" — wait, for clarity place the staff record below
- Correct distribution: two Sale, two Return, one Customer credit, one Staff role change (entityType "User"), one Promotion created (entityType "Promotion"), one Stock adjustment (entityType "StockMovement"), one Expense created (entityType "Expense"), one Shift closed (entityType "ShiftSession")

Set previousValues and newValues as appropriate JSON objects for each. Set createdAt values as new Date(Date.now() - N * 24 * 60 * 60 * 1000) where N decreases from 13 to 4 for each record. Set ipAddress to "127.0.0.1" and userAgent to "VelvetPOS/Seed" for all seed records.

After the createMany call, log "Seeded 10 AuditLog demo entries."

### Step 4: Seed CashMovement Records

Locate the section of the seed script that creates or references a demo ShiftSession. Obtain the shift's id. Check whether CashMovement records already exist for that shift using prisma.cashMovement.count where shiftSessionId equals the demo shift id. If count is greater than zero, skip and log "CashMovements already seeded — skipping."

If count is zero, create two CashMovement records using prisma.cashMovement.createMany:

- First record: type "PETTY_CASH_OUT", amount 15.00, reason "Bought paper cups and straws", createdAt set to 2 hours after the shift's openedAt timestamp. Reference the CASHIER user as userId.
- Second record: type "MANUAL_IN", amount 100.00, reason "Cash float top-up from safe", createdAt set to 4 hours after the shift's openedAt timestamp. Reference the MANAGER user as userId.

Log "Seeded 2 demo CashMovement records."

### Step 5: Update Demo Customers with lastBirthdayMessageSentYear

Use prisma.customer.updateMany to set lastBirthdayMessageSentYear to null for all demo customers in the demo tenant where lastBirthdayMessageSentYear is not already null. This is a defensive update — if the field defaults to null in the schema, most customers will already have null. The updateMany call with a where clause of { tenantId: demoTenantId, lastBirthdayMessageSentYear: { not: null } } ensures no unnecessary writes occur.

Additionally, to create a realistic birthday automation test scenario, identify one demo customer by name and set their birthday to today's month and day (any year) and their lastBirthdayMessageSentYear to null. This allows the birthday automation endpoint to demonstrate its functionality in a demo environment. Update only this one customer using prisma.customer.update by the known demo customer id.

Log "Updated demo customer birthdays and message sent year."

### Step 6: Verify Seed Script Runs Without Errors

Run pnpm prisma db seed to execute the updated seed script. Confirm that all five new operations complete without errors. Review the console output to confirm all "already seeded — skipping" guards activate on a second run (idempotency verification).

## Expected Output

- Demo tenant has settings.hardware populated with NETWORK printer config
- Ten diverse AuditLog records in the demo tenant spanning 14 days and multiple entity types
- Two CashMovement records on the demo shift with distinct types and reasons
- All demo customers have lastBirthdayMessageSentYear as null; one demo customer is configured for birthday automation testing
- Seed script is fully idempotent on repeated runs

## Validation

- [ ] Running pnpm prisma db seed completes without errors on a clean database
- [ ] Running pnpm prisma db seed a second time produces "already seeded — skipping" log lines and does not create duplicate records
- [ ] The demo tenant's settings.hardware contains type "NETWORK", host "192.168.1.100", port 9100
- [ ] The audit log viewer page displays exactly 10 records on the demo tenant after seeding
- [ ] The Z-Report page for the demo shift shows both CashMovement records in the petty cash section
- [ ] The birthday automation endpoint finds the designated demo customer when run on a day matching their birthday

## Notes

- The seed script must not hard-code database IDs as literal strings unless those IDs were generated by the seed script itself in earlier phases using a deterministic upsert. Prefer looking up records by their slug or name using findFirst before referencing their id in related record creation
- If the demo ShiftSession does not exist yet (it may have been created interactively during development rather than by the seed), add a shiftSession upsert to the seed script rather than skipping the CashMovement seeding block
- The AuditLog createdAt values spread across 14 days create a realistic timeline when demonstrated in the audit log viewer, making date range filtering visually meaningful in a demo
