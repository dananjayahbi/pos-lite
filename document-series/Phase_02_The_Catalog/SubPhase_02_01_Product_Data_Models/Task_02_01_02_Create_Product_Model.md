# Task 02.01.02 — Create Product Model

## Metadata

| Property             | Value                                      |
| -------------------- | ------------------------------------------ |
| Sub-Phase            | 02.01 — Product & Variant Data Models      |
| Phase                | 02 — The Catalog                           |
| Estimated Complexity | Medium                                     |
| Dependencies         | Task_02_01_01 (Category and Brand models must exist) |

---

## Objective

Add the Product model along with the GenderType and TaxRule enums to prisma/schema.prisma, apply a named database migration, and verify the model structure and indexes are correctly created in PostgreSQL.

---

## Instructions

### Step 1: Define the GenderType Enum

Before adding the Product model, define the GenderType enum in prisma/schema.prisma. This enum classifies the intended target customer for a product. The values are: MEN, WOMEN, UNISEX, KIDS, and TODDLERS. UNISEX covers products fit for any adult. KIDS applies to children aged roughly 4 to 12. TODDLERS applies to children aged roughly 1 to 3. These distinctions are important for the Sri Lankan clothing store context where sizing and display preferences differ significantly across these groups.

### Step 2: Define the TaxRule Enum

Define the TaxRule enum immediately after GenderType. This enum determines which tax treatment applies to a product at point of sale. The values are:

- STANDARD_VAT: the product is subject to Sri Lanka's standard Value Added Tax rate
- SSCL: the product is subject to the Social Security Contribution Levy rather than standard VAT — applicable to certain categories of goods
- EXEMPT: the product is tax-exempt and no tax is calculated at checkout

The tax rule is stored at the product level (not the variant level) because all variants of a product share the same tax treatment. If a future requirement introduces per-variant tax rules, a database migration can move this field down to the variant level.

### Step 3: Define the Product Model

Add the Product model to the schema after the Brand model. The fields are:

- id: String, primary key, CUID default
- tenantId: String, FK referencing Tenant, mandatory for all multi-tenant isolation
- name: non-optional String, the product display name visible in the POS UI and inventory management
- description: optional String, a longer description for the product
- categoryId: non-optional String, FK referencing Category — every product must be assigned to a category
- brandId: optional String, nullable FK referencing Brand — some products (generic or unbranded items) may not have a brand
- gender: a GenderType enum field — required on every product
- tags: a String array (String[]) allowing free-form tagging for search and filtering — defaults to an empty array
- taxRule: a TaxRule enum field defaulting to STANDARD_VAT
- isArchived: a Boolean defaulting to false — archived products are hidden from the POS product browser but remain visible in inventory management and reporting
- createdAt: DateTime, default now()
- updatedAt: DateTime, @updatedAt
- deletedAt: nullable DateTime for soft deletion

Add the following relation fields:

- A category relation pointing to the Category model via categoryId
- An optional brand relation pointing to the Brand model via brandId
- A tenant relation pointing to the Tenant model via tenantId
- A variants relation as an array of ProductVariant (will be resolved when that model is added)

### Step 4: Add Indexes to the Product Model

Performance-oriented indexes are important on the Product table because it is queried frequently in the POS product browser. Add the following using @@index directives:

An index on tenantId alone, which supports any tenant-scoped query that has no other filter criteria and allows the Postgres query planner to use an index scan for the most basic "fetch all products for this tenant" query.

A composite index on [tenantId, categoryId] to accelerate the common product browser filter of "all products in this category for this tenant" without a full table scan.

A composite index on [tenantId, isArchived, deletedAt] specifically for the POS product list query. The POS browser's most frequent query pattern is: "fetch all non-archived, non-deleted products for this tenant". This three-column index allows PostgreSQL to satisfy that filter using a single index scan rather than scanning the entire Product table, which is critical for response time when a tenant accumulates thousands of products.

### Step 5: Run the Migration

Run pnpm prisma migrate dev --name add_product_model. Confirm the migration output shows the Product table being created with all fields, the GenderType and TaxRule enums being defined as PostgreSQL ENUM types, and the three indexes being created. Check for any schema drift warnings and resolve them before proceeding.

### Step 6: Verify Schema in Database

Connect to the development PostgreSQL instance using psql or a GUI tool and confirm that the products table has been created. Verify the column types, particularly that the tags column uses the PostgreSQL array type (text[]) and that the gender and taxRule columns reference the correct PostgreSQL enum types. Verify all three indexes exist by querying the pg_indexes view.

---

## Expected Output

- GenderType and TaxRule enums are defined in prisma/schema.prisma and appear as ENUM types in PostgreSQL
- The Product table exists in PostgreSQL with all thirteen fields at the correct types
- Three indexes exist on the Product table as described above
- The foreign key constraint on categoryId references the categories table
- The nullable foreign key on brandId allows null values
- pnpm tsc --noEmit passes without errors

---

## Validation

- [ ] Migration named "add_product_model" applies cleanly with no errors
- [ ] GenderType and TaxRule are available as TypeScript enum types in the Prisma Client
- [ ] Product table has a non-nullable categoryId FK and a nullable brandId FK
- [ ] The tags field is typed as String[] in TypeScript and text[] in PostgreSQL
- [ ] The composite index on [tenantId, isArchived, deletedAt] exists in pg_indexes
- [ ] pnpm tsc --noEmit reports no new type errors

---

## Notes

The separation between isArchived and deletedAt is intentional and serves distinct business purposes. Archiving (isArchived = true) is a reversible operational state: a store manager may archive seasonal items or discontinued lines to hide them from the POS cashier screen while still tracking their remaining inventory, viewing their sales history, and potentially un-archiving them at the start of a new season. Deletion (deletedAt = non-null) is used when a product was created in error or must be removed from the system entirely for administrative reasons. Deleted products are excluded from all reporting. Archived products still appear in inventory reports.

This distinction means the inventory management UI must display archived products (to allow un-archiving) while the POS product browser must exclude them. The index on [tenantId, isArchived, deletedAt] is designed precisely for this split — the POS query filters isArchived = false AND deletedAt IS NULL, while the inventory management query filters deletedAt IS NULL only.

The String[] type for tags maps to a PostgreSQL text array. When filtering by tags in the service layer, use Prisma's array-contains filter which translates to PostgreSQL's @> operator. Full-text tag search using GIN indexes is a Phase 05 enhancement.
