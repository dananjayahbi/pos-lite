# Task 03.02.01 — Create Payment Model

## Metadata

| Field | Value |
|---|---|
| Task | 03.02.01 |
| Name | Create Payment Model |
| Sub-Phase | 03.02 — Payments, Receipts & Offline Mode |
| Complexity | Low |
| Depends On | SubPhase_03_01 complete |
| Produces | Prisma Payment model, PaymentLegMethod enum, database migration |

## Objective

Add the Payment Prisma model to schema.prisma so that individual payment legs within a sale are persisted with a clear and immutable record. Introduce the PaymentLegMethod enum to distinguish this model's method field from the Sale-level PaymentMethod enum. Run the migration and confirm the model is available in the Prisma Client.

## Instructions

### Step 1: Understand the Payment Model Design

Before touching schema.prisma, internalise the design rationale. A Sale record already carries a paymentMethod field of enum type PaymentMethod with members CASH, CARD, and SPLIT. This field records the customer-facing payment mode at the sale level. The Payment table records the individual monetary legs of a sale at a lower granularity.

For a CASH sale there is exactly one Payment row with method CASH. For a CARD sale there is exactly one Payment row with method CARD. For a SPLIT sale there are exactly two Payment rows — one CASH and one CARD — both linked to the same saleId. SPLIT is intentionally absent from the Payment-level enum because an individual payment leg is always either a cash exchange or a card charge; the concept of "split" only exists at the sale level as a characterisation of the overall transaction.

A separate enum called PaymentLegMethod is introduced with only the two members CASH and CARD. Giving it a distinct name prevents developers from accidentally using the Sale-level PaymentMethod enum on the Payment model and avoids ambiguity in service-layer type signatures.

### Step 2: Add the PaymentLegMethod Enum

Open prisma/schema.prisma. Locate the existing enum definitions section — specifically the PaymentMethod enum that is already defined for the Sale model. Immediately after the closing brace of the PaymentMethod enum block, add the new PaymentLegMethod enum. Give it the members CASH and CARD in that order. Follow the project's existing naming convention: PascalCase enum identifier, SCREAMING_SNAKE_CASE member values.

### Step 3: Add the Payment Model

After the existing SaleLine model block in schema.prisma, add the Payment model. Define the fields in this order. The id field uses String type with the @id and @default(cuid()) attributes. The saleId field is a String type that provides the foreign key to the Sale table — add a @relation attribute that points to model Sale, field saleId, and references id, and give the relation the named label "SalePayments" to avoid ambiguity with other Sale relations. The method field uses the PaymentLegMethod enum. The amount field uses Decimal type with the @db.Decimal(12, 2) attribute for consistent two-decimal-place monetary precision across all monetary columns in the project. The cardReferenceNumber field is an optional String (nullable) and should only be populated when method is CARD — it stores the cashier-entered approval code from the physical card terminal. The createdAt field is DateTime with the @default(now()) attribute.

Close the model with a @@index([saleId]) block. This index supports the common query pattern of fetching all payments associated with one sale — used in getPaymentsForSale, in sale detail API responses, and in the receipt renderer.

Add a short inline comment on the model itself (as a Prisma schema comment using two forward slashes) directly above the closing brace, stating: "Sum of Payment.amount must equal Sale.totalAmount — enforced in sale.service createSale transaction."

### Step 4: Update the Sale Model Relation

Open the Sale model block in schema.prisma. After the existing saleLine relation field, add a payments field of type Payment array. Reference the relation name "SalePayments" to match the relation declared on the Payment model. This field is a Prisma virtual relation field — it does not produce a column in the sales table; it only enables Prisma Client to include payments in queries via the include clause.

### Step 5: Review the Atomicity Invariant

The invariant — the sum of all Payment.amount values for a given saleId must equal Sale.totalAmount — is not expressed as a database constraint because Prisma does not generate multi-row check constraints and adding a raw SQL constraint would require a custom migration. The invariant is instead enforced exclusively within the Prisma.$transaction call inside sale.service.createSale: the service computes the expected total from the line items, assembles the payment record inputs, sums the payment amounts, and throws a domain error before committing if the sums do not match. Any developer working in the payment service area needs to understand that this invariant exists at the application layer, not the database layer. The schema comment added in Step 3 is the in-schema reminder of this responsibility.

### Step 6: Understand Payment Immutability

Payment records are immutable after creation. There is no soft delete, no updatedAt field, and no deletedAt field on the Payment model. If a sale is voided, the Sale.status field is updated to VOIDED, a voidedAt timestamp is set on the Sale, and a voidReason string is stored, but every Payment record for that sale remains in the database unchanged. This preserves a complete and unalterable financial audit trail that mirrors physical receipt records. No update or delete operations should ever be added to payment.service — this discipline is established at the schema design phase.

### Step 7: Run the Migration

From the project root in the terminal, run pnpm prisma migrate dev with the name flag set to add_payment_model. Prisma will diff the current schema against the database state, generate the SQL for creating the payments table with the correct column types, the foreign key referencing sales(id), and the index on sale_id, and apply the migration to the local development PostgreSQL database. Inspect the generated migration SQL file created under prisma/migrations/ to confirm: the table name is payments, the sale_id foreign key references the sales table with the expected cascade behaviour, the method column uses the correct enum type, the amount column is DECIMAL(12,2), and the index is created.

### Step 8: Regenerate the Prisma Client

After the migration succeeds, run pnpm prisma generate to regenerate the Prisma Client. This ensures that all TypeScript types for Payment, PaymentLegMethod, and the updated Sale type (with the payments relation field) are available in the codebase. Verify by opening the generated types in node_modules/@prisma/client and confirming the Payment type and PaymentLegMethod enum are present.

## Expected Output

- prisma/schema.prisma updated with the PaymentLegMethod enum and Payment model, and the Sale model updated with the payments relation field.
- prisma/migrations/[timestamp]_add_payment_model/migration.sql generated and applied to the local development database.
- Prisma Client regenerated with the Payment type and PaymentLegMethod enum exported and available throughout the codebase.

## Validation

- Run pnpm prisma migrate status and confirm zero pending migrations are reported.
- Open a Prisma Studio session via pnpm prisma studio and verify the payments table appears in the table list with the expected columns: id, sale_id, method, amount, card_reference_number, created_at.
- In the TypeScript application code, write a trivial prisma.payment.findFirst() call and confirm the TypeScript compiler accepts it without type errors.
- Confirm that prisma.sale.findFirst({ include: { payments: true } }) returns the correct type without errors.

## Notes

- Do not add SPLIT to the PaymentLegMethod enum under any circumstance. The two enums (PaymentMethod on Sale and PaymentLegMethod on Payment) have different semantic meanings. Conflating them is a common schema design mistake in split-payment implementations.
- The cardReferenceNumber field stores a plain-text approval code typed by the cashier. It is not a tokenised card number, a PAN, or any PCI-sensitive data. No encryption or masking is required for this field.
- In Phase 05, a paymentGatewayTransactionId field will be added to the Payment model to support the PayHere integration. The current model is intentionally minimal and will accept that additive migration cleanly.
- The @db.Decimal(12, 2) attribute aligns with all other monetary columns in the project (unitPrice, totalAmount, etc.). Never store money as Float on PostgreSQL — floating-point precision errors accumulate in financial arithmetic.
