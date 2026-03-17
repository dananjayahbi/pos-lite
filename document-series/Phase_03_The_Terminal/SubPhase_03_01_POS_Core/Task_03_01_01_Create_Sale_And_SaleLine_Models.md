# Task 03.01.01 — Create Sale And SaleLine Models

## Metadata

| Field | Value |
|---|---|
| Task ID | 03.01.01 |
| Task Name | Create Sale And SaleLine Models |
| Sub-Phase | 03.01 — POS Core |
| Complexity | Low |
| Dependency | Phase 02 fully complete |
| Estimated Schema Lines | ~80 |

## Objective

Add the Sale and SaleLine Prisma models to schema.prisma, introduce the PaymentMethod and SaleStatus enums, extend the existing StockMovementReason enum with SALE and VOID_REVERSAL values, define all necessary compound indexes, and run the database migration to make these structures available for the service layer in subsequent tasks.

## Instructions

### Step 1: Review the Existing Schema

Open prisma/schema.prisma and familiarise yourself with the ProductVariant model (which SaleLine will reference via a foreign key), the User model (which Sale references for cashier, authorising manager, and void actor), and the existing StockMovementReason enum (which requires two new values). Confirm that ProductVariant uses a cuid-based String id field, that User uses a String id field, and that the StockMovementReason enum already includes values such as PURCHASE, ADJUSTMENT, and RETURN from Phase 2. Understanding the existing structure prevents accidental schema drift.

### Step 2: Add the PaymentMethod Enum

After the existing enum declarations in the schema file, add a new enum named PaymentMethod with three values. CASH represents a transaction settled entirely with physical currency. CARD represents a transaction settled entirely via a card terminal or contactless payment device. SPLIT represents a transaction where part of the amount is paid in cash and the remainder on card. Each value is mutually exclusive at the sale level — a single Sale record carries exactly one PaymentMethod value once payment has been accepted. The paymentMethod field on the Sale model is nullable, allowing it to remain unset on OPEN (held) sales prior to payment.

### Step 3: Add the SaleStatus Enum

Add a new enum named SaleStatus with three values representing the complete lifecycle of a sale record. OPEN means the sale has been created and persisted (either held by the cashier or in the process of being completed) but payment has not yet been accepted and no stock has been deducted. COMPLETED means the sale has been paid for, all stock adjustments have been applied atomically, and the transaction is closed. VOIDED means a COMPLETED sale has been reversed within the same open shift — all stock has been restored via VOID_REVERSAL movements and the sale is permanently cancelled. A Sale moves from OPEN to COMPLETED on payment, or from COMPLETED to VOIDED on a manager-authorised void; there is no path from VOIDED back to any other state.

### Step 4: Update the StockMovementReason Enum

Locate the existing StockMovementReason enum and append two new values at the end of the list. SALE is used by the sale service when a transaction is completed and stock is being deducted for each line variant. VOID_REVERSAL is used by the void service when a completed sale is reversed and each variant's stock must be restored to its pre-sale level. These two values form a symmetric pair: every StockMovement with reason SALE that belongs to a subsequently voided sale will have a corresponding StockMovement with reason VOID_REVERSAL referencing the same variant, with the same quantity magnitude but a positive delta instead of a negative one.

### Step 5: Define the Sale Model

Add a new Prisma model named Sale. The id field is a String with a cuid default and serves as the primary key. The tenantId field is a String without a Prisma relation attribute — tenant isolation in VelvetPOS is enforced at the service layer through mandatory tenantId filtering rather than at the database foreign key level, consistent with the pattern established in Phase 01.

The shiftId field is a String with a relation to the Shift model (to be defined in Task 03.01.02); it must be present on all Sale records since every sale belongs to a specific work session. The cashierId field is a String with a relation to the User model identifying the cashier who initiated the transaction. Use a named relation attribute (for example, "SaleCashier") to disambiguate this from the other User relations on the same model.

The subtotal field is a Decimal with the db.Decimal(12,2) attribute representing the sum of all lineTotalAfterDiscount values across every SaleLine. The discountAmount field is a Decimal with db.Decimal(12,2) and a default of 0; it holds the cart-level discount value applied on top of any line-level discounts already reflected in the subtotal. The taxAmount field is a Decimal with db.Decimal(12,2) holding the total tax computed as the sum of all per-line taxes. The totalAmount field is a Decimal with db.Decimal(12,2) holding the final amount due: subtotal minus discountAmount plus taxAmount.

The changeGiven field is an optional Decimal with db.Decimal(12,2) representing the cash returned to the customer; it is null for card-only sales and is populated by the payment handler in SubPhase 03.02. The authorizingManagerId field is an optional String with a named relation to the User model; it is set only when a manager entered their PIN to authorise a discount that exceeded the cashier's allowed threshold. The paymentMethod field is an optional PaymentMethod enum value — null on OPEN sales, set on COMPLETED sales.

The status field is a SaleStatus enum with a default of OPEN. The voidedById field is an optional String with a named relation to the User model. The voidedAt field is an optional DateTime. The whatsappReceiptSentAt field is an optional DateTime, reserved for SubPhase 03.02's WhatsApp integration. The completedAt field is an optional DateTime set to the current timestamp when payment is accepted.

The createdAt field is a DateTime with default now. The updatedAt field is a DateTime with the @updatedAt attribute. The lines relation links to the collection of SaleLine records belonging to this sale.

### Step 6: Define the SaleLine Model

Add a new Prisma model named SaleLine. The id field is a String with a cuid default. The saleId field is a String with a relation to the Sale model. This relation must declare onDelete as Cascade — when a Sale record is deleted (which should only occur in development or controlled cleanup scenarios), its associated SaleLine records are removed alongside it.

The variantId field is a String with a relation to the ProductVariant model. This relation must explicitly not use Cascade deletion. The correct strategy is to leave the deletion behaviour at the Prisma default (Restrict), meaning the application layer must prevent deletion of any ProductVariant that has associated SaleLine records. This is a deliberate design choice: if a variant is retired, archived, or deleted from the catalog after a sale has been fully processed, the SaleLine must remain intact for receipts and historical reports to remain accurate.

The snapshot fields are central to the historical integrity of the data. The productNameSnapshot field is a String capturing the exact product name as it appeared at the moment the cashier processed the sale. The variantDescriptionSnapshot field is a String capturing the full variant descriptor — for example "Navy Blue / Large" or "Cream / One Size" — as it was at sale time. The sku field is a String snapshot of the variant's SKU code at sale time. These three fields exist because product data is mutable: administrators can rename products, change variant attributes, or archive variants at any time. Without snapshots, any change to the product catalog after fulfillment would silently alter the record of what was sold, producing receipts that no longer match what the cashier and customer saw during the transaction. Snapshots ensure the historical sale record and any reprint of the receipt will always display exactly the information that was accurate at the precise moment of sale.

The financial fields are: unitPrice as a Decimal with db.Decimal(12,2) capturing the retail price of one unit at sale time; quantity as an Int representing the number of units sold; discountPercent as a Decimal with db.Decimal(12,2) and a default of 0; discountAmount as a Decimal with db.Decimal(12,2) and a default of 0, computed as (discountPercent ÷ 100) × unitPrice × quantity; lineTotalBeforeDiscount as a Decimal with db.Decimal(12,2), computed as unitPrice × quantity; and lineTotalAfterDiscount as a Decimal with db.Decimal(12,2), computed as lineTotalBeforeDiscount − discountAmount. The createdAt field is a DateTime with default now.

### Step 7: Add Compound Indexes

For the Sale model, define the following index entries at the bottom of the model block. A compound index on [tenantId, status, createdAt] supports the most common query pattern: fetching all sales for a tenant filtered by status and ordered by time. A standalone index on [shiftId] supports shift-level aggregation queries used during shift close. A standalone index on [cashierId] supports cashier-level performance reporting. For the SaleLine model, add an index on [saleId] to support efficient retrieval of all lines for a given sale, and an index on [variantId] to support stock movement audits and variant-level sales history queries.

### Step 8: Run the Migration

From the project root, run the Prisma migration command with the descriptive name "add_sale_and_saleline_models". This command generates a new timestamped SQL migration file in prisma/migrations and applies it to the development database. After a successful migration, run the Prisma client generation command (pnpm prisma generate) to update the TypeScript types exported by the client. Verify that the generated client now exposes the sale and saleLine properties on the db instance and that the PaymentMethod, SaleStatus, and StockMovementReason enums are all accessible from the Prisma namespace.

## Expected Output

- PaymentMethod enum with CASH, CARD, SPLIT values present in schema.prisma
- SaleStatus enum with OPEN, COMPLETED, VOIDED values present in schema.prisma
- StockMovementReason enum updated to include SALE and VOID_REVERSAL at the end of the value list
- Sale model with all specified fields, three named User relations, Shift relation, and SaleLine collection relation
- SaleLine model with all snapshot fields, all financial fields, and the variantId relation without cascade delete
- All compound indexes declared in both models
- Migration file "add_sale_and_saleline_models" present in prisma/migrations and applied to the database
- Prisma client regenerated without TypeScript errors, exposing new types on the db instance

## Validation

- Running pnpm prisma migrate status from the project root reports the new migration as applied with no pending migrations
- Opening Prisma Studio (pnpm prisma studio) shows the Sale and SaleLine tables with the correct column structure, data types, and nullable flags
- Attempting to create a SaleLine with a saleId that does not exist in the Sale table produces a foreign key violation error — confirming the relation is enforced at the database level
- Attempting to create a SaleLine with a variantId that does not exist in the ProductVariant table produces a foreign key violation error
- The TypeScript type auto-generated for SaleLine includes productNameSnapshot, variantDescriptionSnapshot, and sku as non-nullable String fields
- The TypeScript type for Sale includes the authorizingManagerId field as string or null and completedAt as DateTime or null

## Notes

- The snapshot field design is a deliberate denormalization. Do not attempt to normalise these fields after the fact by looking up the ProductVariant at query time — that defeats the purpose entirely. The snapshot is the authoritative data source for all receipt rendering, historical reporting, and dispute resolution. The variant's current catalog entry may diverge from the snapshot at any time.
- The onDelete Restrict behaviour on the variantId relation in SaleLine means the application must guard against variant deletion when sales references exist. Add a pre-deletion check to the variant delete endpoint (from Phase 2) that queries for any SaleLine record referencing the variant before allowing the delete to proceed.
- The Sale.tenantId being stored without a Prisma @relation directive is consistent with the entire codebase. Do not add a Tenant relation to Sale — tenant lookups are done by filtering tenantId as a scalar field, not by joining through a relation.
- The @db.Decimal(12,2) attribute is database-level precision enforcement. The application layer must independently perform its own decimal.js rounding before writing to ensure the two layers are always in agreement.
