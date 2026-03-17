# Task 02.01.06 — Build Product Service Layer

## Metadata

| Property             | Value                                                   |
| -------------------- | ------------------------------------------------------- |
| Sub-Phase            | 02.01 — Product & Variant Data Models                   |
| Phase                | 02 — The Catalog                                        |
| Estimated Complexity | High                                                    |
| Dependencies         | Task_02_01_03 (ProductVariant model must exist in the Prisma Client) |

---

## Objective

Create src/lib/services/product.service.ts implementing all product, variant, category, and brand service functions. This module is the sole entry point for all catalog read and write operations — no Route Handler should ever call Prisma directly for catalog data.

---

## Instructions

### Step 1: Establish the Service File Structure

Create the file src/lib/services/product.service.ts. At the top of the file, import the Prisma Client singleton from src/lib/prisma.ts (the shared instance established in Phase 01). Import any TypeScript types from the Prisma Client that will be used as parameter types or return types. Do not import Prisma types directly from @prisma/client in this file — use the barrel export from the project's Prisma singleton module to ensure a single database connection pool is used across the application.

Define TypeScript input types for each function's data parameter. These types mirror the Zod schema shapes defined in Task 02.01.10, but they are plain TypeScript interfaces here — Zod validation is performed in the Route Handler before calling the service, so the service layer trusts that its inputs are already valid. Using TypeScript interfaces rather than inferring from Zod schemas keeps the service layer independent of the validation library.

### Step 2: Implement getAllProducts

The getAllProducts function accepts tenantId as a string and a filters object containing optional fields: search (string), categoryId (string), brandId (string), gender (GenderType), isArchived (boolean), page (number, default 1), limit (number, default 20).

Construct a Prisma where clause dynamically. Always include tenantId equal to the provided value and deletedAt is null as base conditions. When search is provided, add a case-insensitive contains filter on the name field. When categoryId is provided, add an equality filter on categoryId. When brandId is provided, add an equality filter on brandId. When gender is provided, add an equality filter on gender. When isArchived is provided as a boolean, add an equality filter on isArchived — when isArchived is not provided, the function should include all non-deleted products regardless of archive status (this allows the inventory management UI to see everything).

Use Prisma's include to join the category name and the brand name for each product. Also include a _count sub-query on the variants relation (filtered to non-deleted variants) to provide a total variant count per product. Do not load the full variant array in the list query — this would be too expensive. Variant details are only loaded in getProductById.

Apply skip and take for pagination. Return an object containing the products array and a total count for the calling Route Handler to construct pagination metadata.

### Step 3: Implement getProductById

The getProductById function accepts tenantId and productId. It fetches a single product by id using a Prisma findUnique call. Include the full variants array filtered to non-deleted variants (where deletedAt is null), the category object, and the brand object. If the product is not found or its tenantId does not match the provided tenantId, throw a not-found error with a descriptive message. The tenantId check prevents a BOLA (Broken Object Level Authorization) vulnerability where a user from one tenant could read another tenant's product by guessing its ID.

### Step 4: Implement createProduct

The createProduct function accepts tenantId, actorId (the ID of the authenticated user creating the product), and a data object of type CreateProductInput. Call Prisma's create on the Product model, spreading the data fields and explicitly setting tenantId. After the product is created, write an AuditLog entry using the shared audit logger from Phase 01 (from src/lib/audit.ts or equivalent) with action "PRODUCT_CREATED", the new product's ID as the entityId, entity type "Product", and the actorId. Return the newly created product record.

### Step 5: Implement createProductVariants

The createProductVariants function accepts tenantId, productId, and an array of variant input objects. Before creating any variants, validate that the parent product exists and belongs to the tenant using a findUnique call. Resolve SKUs: for each variant input where sku is not provided, call the internal generateSku helper function. This helper derives the brand code from the product's associated brand name (first four uppercase characters), the colour abbreviation (first three uppercase characters of the colour field), and the size value. If the product has no brand, use "GEN" as the brand code. If colour is absent, use "UNI". If size is absent, use "OS" for one-size.

Before inserting, check for duplicate SKUs within the batch (two items in the input array sharing the same generated SKU) and throw a validation error if any duplicate is found. Also check for existing SKUs in the same tenant using a Prisma findMany call. If any collision is found, throw a descriptive error naming the conflicting SKU.

Wrap the entire variant creation in a Prisma.$transaction to ensure either all variants are created or none are. Use Prisma's createMany within the transaction for efficiency. Return the created variants.

### Step 6: Implement updateProduct

The updateProduct function accepts tenantId, productId, actorId, and a partial data object. First fetch the existing product to capture the before-state for the audit log and to verify tenant ownership. Apply the update using Prisma's update. If the update includes a categoryId change, verify the new category belongs to the same tenant (another BOLA check). Write an AuditLog entry with action "PRODUCT_UPDATED", including a snapshot of the changed fields in the log metadata. Return the updated product.

### Step 7: Implement updateProductVariant

The updateProductVariant function accepts tenantId, variantId, actorId, and a partial data object. Fetch the existing variant and verify its tenantId matches. If the update includes pricing changes (costPrice, retailPrice, or wholesalePrice), write a separate AuditLog entry with action "VARIANT_PRICE_CHANGED" including the before and after prices — price changes are treated as sensitive events and warrant their own audit trail entry. Apply the update and return the updated variant.

### Step 8: Implement softDeleteProduct and archiveProduct

The softDeleteProduct function accepts tenantId, productId, and actorId. In a Prisma transaction, set deletedAt to the current timestamp on the product record and on all of its non-deleted variants using an updateMany where productId equals the given ID and deletedAt is null. Write an AuditLog entry. Return the updated product.

The archiveProduct function accepts tenantId, productId, and actorId. It toggles the isArchived boolean on the product. First fetch the current value, then apply the opposite value in an update. Write an AuditLog entry noting whether the product was archived or unarchived. This function does not touch variants — archiving a product hides it from the POS but individual variants retain their own deletedAt state independently.

### Step 9: Implement Category Service Functions

Implement getAllCategories(tenantId): returns all non-deleted categories for the tenant, ordered by sortOrder ascending and then name ascending. Include a _count of associated non-deleted products for each category to display in the management UI.

Implement createCategory(tenantId, data): checks for an existing non-deleted category with the same name in the same tenant before creating — throw a 409-style conflict error if a duplicate name is found. If parentId is provided, verify the parent category exists and belongs to the same tenant.

Implement updateCategory(tenantId, categoryId, data): verifies ownership, applies changes, checks for name conflicts on rename.

Implement softDeleteCategory(tenantId, categoryId, actorId): before setting deletedAt, confirm that no non-deleted products have categoryId equal to this category's ID. If any products are found, throw a conflict error explaining that the category cannot be deleted while products are assigned to it. Only when the category is empty should the deletion proceed.

### Step 10: Implement Brand Service Functions

Implement getAllBrands(tenantId): returns all non-deleted brands ordered by name.

Implement createBrand(tenantId, data): checks for name uniqueness within the tenant.

Implement updateBrand(tenantId, brandId, data): verifies ownership and applies updates.

Implement softDeleteBrand(tenantId, brandId, actorId): checks that no non-deleted products reference this brand before allowing deletion. If products exist, throw a conflict error.

### Step 11: Cost Price Filtering Pattern

The service functions in this file always return the full variant object including costPrice. They do not filter out costPrice themselves. The responsibility for omitting costPrice from the API response rests entirely with the Route Handler. This separation of concerns means the service layer is usable in server-side contexts (such as internal reporting or PDF generation) where the full data is legitimately needed, regardless of the requester's frontend permissions. Document this pattern clearly in a comment at the top of the module so future developers do not add permission filtering inside the service layer.

---

## Expected Output

- src/lib/services/product.service.ts exists with all fourteen service functions
- getAllProducts returns a paginated result object with a products array and total count
- getProductById throws a typed not-found error for missing or cross-tenant access attempts
- createProductVariants wraps creation in a transaction and generates SKUs automatically
- softDeleteCategory and softDeleteBrand check for dependent products before deleting
- All write operations write an AuditLog entry via the shared audit logger
- costPrice is never stripped in the service layer — stripping is the Route Handler's responsibility

---

## Validation

- [ ] getAllProducts with no filters returns all non-deleted products for the tenant with pagination
- [ ] getAllProducts with isArchived false excludes archived products
- [ ] getProductById with a cross-tenant productId throws a not-found error
- [ ] createProductVariants with two identical SKUs in the input array throws a validation error before any database write
- [ ] softDeleteProduct sets deletedAt on all child variants atomically
- [ ] softDeleteCategory with associated products throws a 409-style error
- [ ] An AuditLog entry is created for each create, update, and delete operation
- [ ] pnpm tsc --noEmit passes with no type errors in product.service.ts

---

## Notes

The getAllProducts function uses a Prisma contains filter for the search functionality, which translates to a SQL LIKE query with wildcards. This is intentionally simple — it is "Phase 1 search" that works adequately for catalogs under a few thousand products. A full PostgreSQL tsvector full-text search upgrade is planned for Phase 05 and will be implemented as a backward-compatible change to this function signature, so the Route Handler and UI do not need to change.

The generateSku helper function should be a private unexported function within the service file. It is not part of the public API surface of the module. If business requirements for SKU format change, this single function is the only place to update.

When checking for category or brand references before soft deletion, use a Prisma count query rather than findMany to avoid loading potentially thousands of product records into memory just to check if any exist.
