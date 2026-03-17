# Task 02.01.03 — Create ProductVariant Model

## Metadata

| Property             | Value                                           |
| -------------------- | ----------------------------------------------- |
| Sub-Phase            | 02.01 — Product & Variant Data Models           |
| Phase                | 02 — The Catalog                                |
| Estimated Complexity | Medium                                          |
| Dependencies         | Task_02_01_02 (Product model and enums must exist) |

---

## Objective

Add the ProductVariant model to prisma/schema.prisma with all required fields, unique constraints, and performance indexes. Apply the migration and verify the model behaves correctly with a test insert and barcode lookup.

---

## Instructions

### Step 1: Understand the Role of ProductVariant

Before writing the model, understand what a ProductVariant represents and why its design differs from the Product model. A ProductVariant is a single purchasable unit of a product — a specific combination of size, colour, and any other differentiating attributes. In a clothing store, "Men's Oxford Shirt" is the Product. "Men's Oxford Shirt — Blue — L" is the ProductVariant. Every item that gets scanned at checkout, every stock quantity tracked, and every price displayed at the POS belongs to a ProductVariant, not to the Product itself.

This means the ProductVariant table will have far more rows than the Product table, and it will be queried at very high frequency during sales operations (the barcode lookup is triggered on every scan). These facts directly motivate several design decisions explained in later steps.

### Step 2: Define the ProductVariant Model Fields

Add the ProductVariant model to prisma/schema.prisma after the Product model. The fields are:

- id: String, primary key, CUID default, unique identifier for this variant globally
- productId: non-optional String, FK referencing Product — a variant must always belong to a product
- tenantId: non-optional String, FK referencing Tenant — see the denormalization rationale in Step 5
- sku: non-optional String, the Stock Keeping Unit code for this variant — must be unique per tenant (composite unique constraint detailed in Step 4)
- barcode: optional and nullable String, the physical barcode printed on the garment's label (EAN-13 or similar) — may be null if no barcode has been assigned
- size: optional String, the size designation such as S, M, L, XL, or 8Y for kids — stored as a plain string to accommodate the diverse size systems used across garment categories
- colour: optional String, the colour name as it will appear on receipts and in inventory — stored as a string rather than an enum to allow custom colour names entered by store staff
- costPrice: Decimal field with the @db.Decimal(12,2) annotation — the landed cost price per unit at which the store procures this variant from its supplier
- retailPrice: Decimal field with @db.Decimal(12,2) — the selling price to end customers at the POS
- wholesalePrice: optional Decimal field with @db.Decimal(12,2) — the bulk selling price for wholesale customers; nullable because not all variants have a configured wholesale price
- stockQuantity: Int defaulting to 0 — the current on-hand quantity for this variant in the store
- lowStockThreshold: Int defaulting to 5 — when stockQuantity falls at or below this threshold the variant appears in low-stock alerts
- imageUrls: String array (String[]) defaulting to an empty array — URLs of product images for this specific variant (e.g., a blue shirt has different images than the same shirt in white)
- createdAt: DateTime, default now()
- updatedAt: DateTime, @updatedAt
- deletedAt: nullable DateTime for soft deletion of the variant without deleting the parent product

Add relation fields: a product relation pointing to the Product model via productId, a stockMovements relation as an array of StockMovement (resolved in Task 02.01.04), and a stockTakeItems relation as an array of StockTakeItem (resolved in Task 02.01.05).

### Step 3: Add the tenantId Relation Declaration

The tenantId field on ProductVariant needs both a @relation marker and an index. Declare the tenant relation pointing to the Tenant model via the tenantId field. This makes the FK explicit in the Prisma schema and enables the Prisma Client to type the relation correctly.

It is important to understand why tenantId is stored on every ProductVariant even though it can always be derived by following the productId FK to the parent Product and reading its tenantId. The reason is query performance — specifically, the barcode scan lookup at the POS. When a cashier scans a barcode, the system must find the matching ProductVariant by barcode value and must also confirm it belongs to the correct tenant (to prevent cross-tenant data leakage). Without tenantId on the variant, this lookup would require a JOIN between the ProductVariant table and the Product table just to filter by tenant, adding latency on every single scan. With tenantId stored directly on the variant, the query can be fully satisfied using a single-table index scan on the [barcode, tenantId] composite index, which is significantly faster at scale.

### Step 4: Define Unique Constraints for SKU and Barcode

The SKU must be unique within a tenant — two variants in the same tenant cannot share a SKU. Add a composite unique constraint using @@unique([tenantId, sku]) to enforce this at the database level.

For barcode uniqueness, the situation is more complex. A barcode should be unique per tenant when it is assigned — two variants in the same tenant cannot share the same barcode. However, barcode is a nullable field. In relational databases, NULL is not considered equal to NULL, so a simple composite unique index on [tenantId, barcode] would allow multiple rows with the same tenantId and a null barcode without raising a constraint violation. This is the correct behaviour for the barcode field. Therefore, add a composite unique constraint on [tenantId, barcode] — Prisma will create a standard unique index, and the database's NULL-equality rules will naturally allow multiple rows with null barcodes. Application logic in the service layer must additionally reject attempts to assign a barcode that is already in use by another variant in the same tenant.

### Step 5: Add Performance Indexes

Three indexes are essential for the ProductVariant table:

An index on tenantId alone, to support any broad tenant-scoped query such as "list all variants for inventory reporting".

A composite index on [productId, tenantId], supporting the common pattern of fetching all variants of a specific product while maintaining the tenantId filter as a safety check.

A composite index on [barcode, tenantId], which is the critical performance index for the POS barcode scan path. This index allows the database to find a variant by barcode and verify its tenant membership in a single index lookup without touching the main table pages. This index should result in sub-50ms lookups even with hundreds of thousands of variants in the database.

### Step 6: Run the Migration

Run pnpm prisma migrate dev --name add_product_variant_model. Review the generated SQL to confirm that the Decimal fields use NUMERIC(12,2) as their PostgreSQL type, that imageUrls is text[] as expected, and that all three indexes are included in the CREATE INDEX statements. Confirm the migration applies without errors.

### Step 7: Insert a Test Variant and Verify Barcode Lookup

Using the Prisma Studio interface or psql, manually insert a test ProductVariant record into a test tenant (you can use the development tenant created in Phase 01). Set the barcode to a value such as 4891234567890. Then verify that the query SELECT * FROM "ProductVariant" WHERE barcode = '4891234567890' AND "tenantId" = '<dev-tenant-id>' returns exactly one row without needing to reference the Product table. Confirm the EXPLAIN output shows an index scan rather than a sequential scan on the barcode index. Delete the test record after verification.

### Step 8: Decimal Configuration Note

Verify that the Prisma client correctly types costPrice, retailPrice, and wholesalePrice as Prisma.Decimal rather than number. Any arithmetic involving these fields in application code must use the decimal.js Decimal class. The Prisma.Decimal type is compatible with the Decimal class from decimal.js, so comparisons and operations can be performed seamlessly as long as native JavaScript number arithmetic is never applied to these fields.

---

## Expected Output

- The ProductVariant model is defined in prisma/schema.prisma with all seventeen fields at the correct types
- Composite unique constraints exist on [tenantId, sku] and [tenantId, barcode]
- Three indexes exist: on tenantId, on [productId, tenantId], and on [barcode, tenantId]
- costPrice, retailPrice, and wholesalePrice are NUMERIC(12,2) columns in PostgreSQL
- imageUrls is a text[] column defaulting to an empty array
- The migration applies cleanly and pnpm prisma generate completes without errors

---

## Validation

- [ ] Migration named "add_product_variant_model" applies without errors
- [ ] The unique constraint on [tenantId, sku] prevents duplicate SKUs for the same tenant
- [ ] The unique constraint on [tenantId, barcode] allows multiple null barcodes per tenant
- [ ] An EXPLAIN of the barcode lookup query shows an index scan on the barcode+tenantId index
- [ ] costPrice, retailPrice, and wholesalePrice are typed as Prisma.Decimal in the generated client
- [ ] imageUrls defaults to an empty array and accepts an array of string URLs
- [ ] pnpm tsc --noEmit passes with no new type errors

---

## Notes

The SKU auto-generation format is [BRAND-CODE]-[COLOUR-ABBREV]-[SIZE]. The brand code is derived by taking the first four characters of the brand name in uppercase (e.g., "NovaWear" becomes "NOVA"). The colour abbreviation is the first three uppercase characters of the colour string (e.g., "Midnight Blue" becomes "MID"). The size is used as-is. This produces SKUs like NOVA-MID-L or SILKT-WHT-XS. Auto-generation is handled by the product service layer in Task 02.01.06; the model itself only stores the final resolved SKU string.

Decimal precision of 12,2 means values up to 9,999,999,999.99 can be stored, which is more than sufficient for Sri Lankan Rupee pricing. However, the key concern is not overflow but underflow: division operations in service code (such as computing gross margin percentage) must use decimal.js throughout to avoid floating-point rounding errors on the intermediate values, even though the final stored result is always rounded to two decimal places before being written to the database.

The lowStockThreshold per variant allows store staff to set different alert levels for fast-moving items (threshold of 10) versus slow-moving items (threshold of 2) without changing any global configuration. This is preferable to a single global threshold setting because clothing stores often stock very different quantities of different SKUs — a basic white T-shirt in size M needs a higher threshold than a luxury jacket in an unusual size.
