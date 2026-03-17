# Task 04.01.01 — Create Customer and Supplier Models

## Metadata

| Field | Value |
|---|---|
| Task ID | 04.01.01 |
| Task Name | Create Customer and Supplier Models |
| SubPhase | 04.01 — CRM and Supplier Management |
| Complexity | Medium |
| Estimated Effort | 2–3 hours |
| Prerequisites | Phase 03 schema fully migrated |
| Output | Updated `prisma/schema.prisma`, new migration file |

---

## Objective

Extend the Prisma schema with all data models required for CRM and procurement: `Customer`, `Supplier`, `PurchaseOrder`, `PurchaseOrderLine`, `CustomerBroadcast`, and `BirthdayGreetingLog`. Add the `POStatus` enum. Add nullable foreign key fields `customerId` and `salespersonId` to the existing `Sale` model if they are not already present. Apply all necessary composite indexes and run the migration.

---

## Context

Phase 03 established the `Sale`, `SaleLine`, `Payment`, `Shift`, `ShiftClosure`, `Return`, `ReturnLine`, and `StoreCredit` models. This task layers the CRM and supply-chain schema on top without modifying any existing model's core fields — only additive changes are made unless the `Sale` model is missing its customer link. The `adjustStock` service already accepts an optional Prisma transaction client, so the `PurchaseOrder` receiving workflow can use it without further modification.

---

## Instructions

### Step 1: Add the POStatus Enum

Open `prisma/schema.prisma`. After the existing enums section, declare a new enum named `POStatus` with the values `DRAFT`, `SENT`, `PARTIALLY_RECEIVED`, `RECEIVED`, and `CANCELLED`. This enum represents the full lifecycle of a purchase order and is used as the `status` field type on the `PurchaseOrder` model.

### Step 2: Add the Customer Model

Define the `Customer` model with the following fields:

- `id` — String, `@id`, `@default(cuid())`.
- `tenantId` — String with a relation to `Tenant`.
- `name` — String.
- `phone` — String (must be stored as entered; no normalisation at DB level — validation is in the service layer).
- `email` — String, optional (`String?`).
- `gender` — the existing `Gender` enum if one exists in the schema, or a new `Gender` enum with values `MALE`, `FEMALE`, `OTHER`. Add the enum if it does not already exist.
- `birthday` — `DateTime?` (optional).
- `tags` — `String[]` (Postgres array of strings).
- `notes` — `String?`.
- `creditBalance` — `Decimal @default(0)` — signed; positive means the store owes the customer.
- `totalSpend` — `Decimal @default(0)` — cumulative completed-sale spend.
- `isActive` — `Boolean @default(true)`.
- `deletedAt` — `DateTime?` — when soft-deleted.
- `createdAt` — `DateTime @default(now())`.
- `updatedAt` — `DateTime @updatedAt`.
- Relation `tenant Tenant @relation(fields: [tenantId], references: [id])`.
- Relation `sales Sale[]` — back-relation from Sales.
- Relation `broadcasts CustomerBroadcast[]`.
- Relation `birthdayLogs BirthdayGreetingLog[]`.

Add two `@@index` directives: one on `[tenantId]` and one on `[tenantId, phone]`. The composite index on `(tenantId, phone)` supports duplicate detection during CSV import and is used by the POS customer-search endpoint.

### Step 3: Update the Sale Model for Customer Linking

Locate the `Sale` model. If `customerId` is not already a field, add `customerId String?` and the relation `customer Customer? @relation(fields: [customerId], references: [id])`. If `salespersonId` is not already present, add `salespersonId String?` and the corresponding relation to `User`. These are both nullable so that existing sales without a linked customer remain valid.

### Step 4: Add the Supplier Model

Define the `Supplier` model with the following fields:

- `id` — String, `@id`, `@default(cuid())`.
- `tenantId` — String, relation to `Tenant`.
- `name` — String.
- `contactName` — String, optional.
- `phone` — String.
- `whatsappNumber` — `String?` — separate from `phone` because the supplying contact may prefer a different number for WhatsApp notifications.
- `email` — `String?`.
- `address` — `String?`.
- `leadTimeDays` — `Int @default(7)`.
- `notes` — `String?`.
- `isActive` — `Boolean @default(true)`.
- `createdAt` — `DateTime @default(now())`.
- `updatedAt` — `DateTime @updatedAt`.
- Relation `tenant Tenant @relation(...)`.
- Relation `purchaseOrders PurchaseOrder[]`.

Add `@@index([tenantId])`.

### Step 5: Add the PurchaseOrder Model

Define the `PurchaseOrder` model:

- `id` — String, `@id`, `@default(cuid())`.
- `tenantId` — String, relation to `Tenant`.
- `supplierId` — String, relation to `Supplier`.
- `createdById` — String, relation to `User`.
- `expectedDeliveryDate` — `DateTime?`.
- `status` — `POStatus @default(DRAFT)`.
- `notes` — `String?`.
- `totalAmount` — `Decimal @default(0)` — computed and written by the service when lines are upserted; not a Prisma-computed field.
- `createdAt` — `DateTime @default(now())`.
- `updatedAt` — `DateTime @updatedAt`.
- Relation `supplier Supplier @relation(...)`.
- Relation `createdBy User @relation(...)`.
- Relation `lines PurchaseOrderLine[]`.

Add `@@index([tenantId, status])`.

### Step 6: Add the PurchaseOrderLine Model

Define the `PurchaseOrderLine` model:

- `id` — String, `@id`, `@default(cuid())`.
- `purchaseOrderId` — String, relation to `PurchaseOrder`.
- `variantId` — String, relation to `ProductVariant`.
- `productNameSnapshot` — String — captured at PO creation so the line is readable even if the product is later deleted.
- `variantDescriptionSnapshot` — String — same rationale.
- `orderedQty` — Int.
- `expectedCostPrice` — Decimal.
- `receivedQty` — `Int @default(0)`.
- `actualCostPrice` — `Decimal?` — filled in during goods receiving.
- `isFullyReceived` — `Boolean @default(false)`.
- Relation `purchaseOrder PurchaseOrder @relation(...)`.
- Relation `variant ProductVariant @relation(...)`.

Add `@@index([purchaseOrderId])`.

### Step 7: Add the CustomerBroadcast Model

Define the `CustomerBroadcast` model. This model records every marketing broadcast campaign sent via the broadcast builder:

- `id` — String, `@id`, `@default(cuid())`.
- `tenantId` — String, relation to `Tenant`.
- `message` — String — the full message body that was sent.
- `sentAt` — `DateTime @default(now())`.
- `recipientCount` — Int — the number of recipients the message was actually sent to.
- `sentById` — String, relation to `User` — who triggered the broadcast.
- `filters` — `Json` — a snapshot of the filter criteria used to select recipients (e.g., `{ tag: "VIP", spendMin: 5000 }`). Stored as JSON rather than structured columns because filter shapes vary and can evolve without migrations.
- Relation `tenant Tenant @relation(...)`.
- Relation `sentBy User @relation(...)`.

### Step 8: Add the BirthdayGreetingLog Model

Define the `BirthdayGreetingLog` model for audit trail purposes:

- `id` — String, `@id`, `@default(cuid())`.
- `tenantId` — String, relation to `Tenant`.
- `customerId` — String, relation to `Customer`.
- `sentAt` — `DateTime @default(now())`.
- `status` — a new inline enum or a `String` field constrained to `SENT` or `FAILED`. Recommended approach: use a plain `String` field and validate at the service layer to avoid enum proliferation. Document this choice in a comment.
- `errorMessage` — `String?` — populated when `status` is `FAILED`.

### Step 9: Run the Migration

After saving the schema, run the migration by executing `pnpm prisma migrate dev --name add_crm_and_supplier_models` in the project root. This command generates the SQL migration file under `prisma/migrations/`, applies it to the development database, and regenerates the Prisma Client types. Confirm there are no drift warnings or unresolved conflicts before proceeding. If the Prisma Client generation step fails due to a TypeScript version mismatch, run `pnpm prisma generate` separately.

### Step 10: Verify in Prisma Studio

Launch Prisma Studio by running `pnpm prisma studio`. Confirm that the following tables are visible and their columns match the schema: `Customer`, `Supplier`, `PurchaseOrder`, `PurchaseOrderLine`, `CustomerBroadcast`, `BirthdayGreetingLog`. Check that the `Sale` table now shows a `customerId` column. Close Studio when done.

---

## Expected Output

- `prisma/schema.prisma` — updated with six new models, one new enum (`POStatus`), optional `Gender` enum if added, and the two new nullable fields on `Sale`.
- `prisma/migrations/[timestamp]_add_crm_and_supplier_models/migration.sql` — the generated SQL file containing `CREATE TABLE` statements for all new models, `ALTER TABLE` statements for `Sale`, and all `CREATE INDEX` statements.
- Prisma Client regenerated and TypeScript types updated to include all new model types.

---

## Validation

- [ ] `pnpm prisma migrate dev` completes without errors and reports "Migration applied successfully".
- [ ] `pnpm prisma studio` shows Customer, Supplier, PurchaseOrder, PurchaseOrderLine, CustomerBroadcast, and BirthdayGreetingLog tables.
- [ ] The `Sale` table in Prisma Studio displays a `customerId` column.
- [ ] TypeScript compilation (`pnpm tsc --noEmit`) passes — no type errors introduced by the new models.
- [ ] `@@index([tenantId, phone])` on Customer is present in the migration SQL.
- [ ] `@@index([tenantId, status])` on PurchaseOrder is present in the migration SQL.

---

## Notes

- The `Sale.customerId` relation is deliberately nullable and does not break any existing Phase 03 sale data — all historical sales simply have `null` in that column.
- The `CustomerBroadcast.filters` field is typed as `Json` rather than a structured relation to avoid over-normalising a metadata field that is append-only and never queried with fine-grained predicates.
- If the `Tenant` model does not yet have a `customers`, `suppliers`, or `broadcasterHistory` back-relation array, add the implicit back-relations (`customers Customer[]`, `suppliers Supplier[]`, etc.) to the `Tenant` model to keep Prisma's relation completeness rules satisfied.
- Do not use `@@unique([tenantId, phone])` on Customer — uniqueness is enforced at the service layer with a graceful error message rather than a database exception, because duplicate phone handling during CSV import requires soft skipping rather than a hard failure.
