# Task 05.02.01 — Create Billing Models

## Metadata

| Property | Value |
|---|---|
| Task ID | 05.02.01 |
| SubPhase | 05.02 — Billing and WhatsApp Automation |
| Complexity | High |
| Depends On | SubPhase 05.01 (Tenant model established) |
| Primary Files | prisma/schema.prisma, prisma/migrations/ |
| Roles Involved | SUPER_ADMIN (setup only) |
| Migration Name | add_billing_models |

## Objective

Extend the Prisma schema with five billing models — SubscriptionPlan, Subscription, Invoice, InvoicePaymentEvent, and PaymentReminder — along with the enums required to drive billing state machines. Add a denormalized subscriptionStatus field to the Tenant model for fast middleware access. Apply the migration and regenerate the Prisma Client.

## Instructions

### Step 1: Add All Required Enums

Open prisma/schema.prisma. Locate the section where existing enums are declared near UserRole. Add the following enums sequentially:

- SubscriptionStatus with five values: TRIAL, ACTIVE, PAST_DUE, SUSPENDED, CANCELLED. This enum powers both the Subscription.status field and the denormalized Tenant.subscriptionStatus field.
- InvoiceStatus with four values: PENDING, PAID, FAILED, VOIDED. VOIDED is reserved for invoices manually cancelled by a Super Admin before payment.
- PaymentReminderType with three values: THREE_DAY_REMINDER, DUE_DATE_REMINDER, OVERDUE_REMINDER. These map to the three automated WhatsApp/email reminder intervals.
- PaymentReminderChannel with two values: WHATSAPP, EMAIL.
- PaymentReminderSendStatus with two values: SENT, FAILED. Distinct from InvoiceStatus — this tracks the delivery outcome of a single communication, not the payment.

### Step 2: Update the Tenant Model

Locate the Tenant model in the schema. Add a new field subscriptionStatus of type SubscriptionStatus with a default value of TRIAL. This field is intentionally denormalized from the Subscription table: it allows the Next.js middleware to read billing state from the session token or a single Tenant lookup without a join. Every billing service function that changes Subscription.status must also update this field in the same transaction. Also add a subscriptions relation field typed as Subscription[] to complete the back-relation. Add a subscription relation field typed as Subscription (singular) representing the one-to-one active subscription.

### Step 3: Add the SubscriptionPlan Model

Declare a model named SubscriptionPlan with the following fields:

- id as a String primary key using cuid()
- name as a String with a unique constraint — valid values are "STARTER", "GROWTH", and "ENTERPRISE"
- monthlyPrice as a Decimal with precision 10 and scale 2 using the @db.Decimal annotation
- annualPrice as a Decimal with the same precision annotation
- maxUsers as an Int representing the maximum number of user accounts allowed for tenants on this plan
- maxProductVariants as an Int representing the cap on product variant records
- features as a String array — this maps to a PostgreSQL text array and holds feature flag strings such as "pos:returns" and "reports:advanced"
- isActive as a Boolean defaulting to true — inactive plans are hidden from new signups but remain attached to existing subscriptions
- createdAt as a DateTime defaulting to now()
- subscriptions as a Subscription array (back-relation field, no @relation annotation needed here)

Apply the @@map("subscription_plans") table name annotation.

### Step 4: Add the Subscription Model

Declare a model named Subscription with the following fields:

- id as a String primary key using cuid()
- tenantId as a String with a @unique constraint — this enforces the one-to-one relationship between Tenant and Subscription
- tenant as a Tenant relation referencing id on Tenant, with onDelete set to Cascade so that deleting a tenant removes its subscription
- planId as a String referencing SubscriptionPlan
- plan as a SubscriptionPlan relation referencing id on SubscriptionPlan
- status as a SubscriptionStatus defaulting to TRIAL
- trialEndsAt as a nullable DateTime — set at creation, null for non-trial subscriptions
- currentPeriodStart as a DateTime — the start of the currently active billing period
- currentPeriodEnd as a DateTime — the end of the currently active billing period; this is the primary reference date for grace period calculations
- payhereSubscriptionToken as a nullable String — populated when PayHere returns a recurring subscription token via IPN
- cancelledAt as a nullable DateTime
- createdAt as a DateTime defaulting to now()
- updatedAt as a DateTime using @updatedAt
- invoices as an Invoice array (back-relation)

Add three index directives: @@index on [tenantId], @@index on [status], and @@index on [currentPeriodEnd]. The index on currentPeriodEnd is critical for the grace period cron query. Apply @@map("subscriptions").

### Step 5: Add the Invoice Model

Declare a model named Invoice with the following fields:

- id as a String primary key using cuid()
- tenantId as a String referencing Tenant (with Cascade delete)
- tenant as a Tenant relation
- subscriptionId as a String referencing Subscription
- subscription as a Subscription relation
- amount as a Decimal with precision 10 and scale 2
- currency as a String defaulting to "LKR"
- status as an InvoiceStatus defaulting to PENDING
- billingPeriodStart as a DateTime
- billingPeriodEnd as a DateTime
- dueDate as a DateTime — when payment is due, used as the reference for reminder scheduling
- paidAt as a nullable DateTime — set only when status transitions to PAID
- payhereOrderId as a nullable String — this equals the invoice's own id when passed to PayHere, stored for audit correlation
- invoiceNumber as a String with a unique constraint — formatted as INV-YYYY-NNNN (e.g., "INV-2025-0042")
- pdfUrl as a nullable String — populated when the PDF is stored in Vercel Blob or equivalent object storage
- createdAt as a DateTime defaulting to now()
- paymentEvents as an InvoicePaymentEvent array (back-relation)
- reminders as a PaymentReminder array (back-relation)

Add indexes: @@index on [tenantId], @@index on [status], @@index on [dueDate]. The index on dueDate enables efficient reminder cron queries. Apply @@map("invoices").

### Step 6: Add the InvoicePaymentEvent Model

Declare a model named InvoicePaymentEvent to record every IPN notification received from PayHere as an immutable audit trail. Fields:

- id as a String primary key using cuid()
- invoiceId as a String referencing Invoice (with Cascade delete from Invoice)
- invoice as an Invoice relation
- payhereStatusCode as an Int — the raw integer status_code from PayHere (2 = success, 0 = pending, -1 = cancelled, -2 = failed)
- payhereOrderId as a String — the order_id echoed in the IPN
- payhereAmount as a Decimal with precision 10 and scale 2 — the amount echoed in the IPN
- payhereMd5sig as a String — the received signature value (stored for forensic comparison, never trusted to update state)
- signatureValid as a Boolean — true if the computed signature matched the received signature, false otherwise
- rawPayload as a String (mapped to a text column) — the full URL-encoded POST body exactly as received from PayHere for forensic replay
- createdAt as a DateTime defaulting to now()

No update fields — this model is append-only. Apply @@map("invoice_payment_events").

### Step 7: Add the PaymentReminder Model

Declare a model named PaymentReminder to record every automated payment reminder communication attempt. Fields:

- id as a String primary key using cuid()
- tenantId as a String referencing Tenant (with Cascade delete)
- tenant as a Tenant relation
- invoiceId as a String referencing Invoice
- invoice as an Invoice relation
- type as a PaymentReminderType enum
- sentAt as a DateTime — when the attempt was made
- channel as a PaymentReminderChannel enum
- status as a PaymentReminderSendStatus enum

Apply @@map("payment_reminders").

### Step 8: Run the Migration

Execute the Prisma migration by running "pnpm prisma migrate dev --name add_billing_models" in the terminal. Review the generated SQL file in prisma/migrations/ to verify:
- The subscription_status column exists on the tenants table with DEFAULT 'TRIAL'
- All five tables are created: subscription_plans, subscriptions, invoices, invoice_payment_events, payment_reminders
- The three indexes on the subscriptions table are present (tenantId, status, current_period_end)
- The three indexes on the invoices table are present (tenantId, status, due_date)
- All foreign key constraints carry ON DELETE CASCADE where Cascade was specified

If any drift is detected in the shadow database, resolve it before proceeding.

### Step 9: Regenerate the Prisma Client

After a successful migration, run "pnpm prisma generate" to regenerate the TypeScript Prisma Client. Confirm the five new model types appear in the generated client under node_modules/.prisma/client/index.d.ts.

### Step 10: Verify Cascade Behaviour and Back-Relations

Manually inspect the generated migration SQL to confirm all Cascade delete chains:
- Deleting a Tenant cascades to Subscription, Invoice, and PaymentReminder
- Deleting an Invoice cascades to InvoicePaymentEvent and PaymentReminder

Run "pnpm prisma db pull" against a development database to verify the schema round-trips cleanly (the inferred schema from the real database matches the written schema).

## Expected Output

- Five new Prisma models committed to prisma/schema.prisma
- Five new enums added: SubscriptionStatus, InvoiceStatus, PaymentReminderType, PaymentReminderChannel, PaymentReminderSendStatus
- A migration file at prisma/migrations/YYYYMMDDHHMMSS_add_billing_models/migration.sql
- Regenerated Prisma Client with full TypeScript types for all billing models
- Tenant model updated with subscriptionStatus (default TRIAL) and back-relation fields

## Validation

- [ ] pnpm prisma migrate dev runs to completion without error
- [ ] pnpm prisma generate completes without TypeScript or schema warnings
- [ ] All five enum types are present in the generated Prisma Client types
- [ ] subscription_plans, subscriptions, invoices, invoice_payment_events, payment_reminders tables exist in the database
- [ ] Tenant.subscriptionStatus column exists and defaults to TRIAL in a freshly inserted row
- [ ] The three @@index directives on Subscription (tenantId, status, currentPeriodEnd) appear in the migration SQL
- [ ] ON DELETE CASCADE clauses are verified in the migration SQL for all cascaded foreign keys
- [ ] payhereSubscriptionToken on Subscription is nullable and absent from non-trial rows by default
- [ ] invoiceNumber on Invoice has a UNIQUE constraint in the database

## Notes

- The payhereSubscriptionToken field will only be populated when PayHere returns a recurring subscription token, which occurs for the recurring payment product type. For one-time charges the field remains null for the subscription's lifetime.
- The rawPayload field on InvoicePaymentEvent is typed as String but should be stored in a PostgreSQL TEXT column to handle large bodies without truncation. Confirm the column type in the generated migration.
- The features array on SubscriptionPlan maps natively to a PostgreSQL text[] column. In Prisma 5 and later, String[] is declared without additional db annotations for text arrays.
- The subscriptionStatus field on Tenant is explicitly denormalized for read performance. The single source of truth for billing state is Subscription.status. Any tooling that updates Subscription.status must update Tenant.subscriptionStatus in the same Prisma transaction without exception.
