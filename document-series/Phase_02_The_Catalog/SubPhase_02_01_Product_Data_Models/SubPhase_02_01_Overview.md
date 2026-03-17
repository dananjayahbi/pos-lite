# SubPhase 02.01 — Product & Variant Data Models

## Metadata

| Property       | Value                                              |
| -------------- | -------------------------------------------------- |
| Phase          | 02 — The Catalog                                   |
| Sub-Phase      | 02.01                                              |
| Status         | Planned                                            |
| Dependencies   | Phase 01 fully complete (SubPhases 01.01, 01.02, 01.03 all done) |

---

## Objective

This sub-phase establishes the complete data layer for the VelvetPOS clothing catalog. Every Prisma model required to represent products, variants, categories, brands, stock movements, and stock take sessions is defined here, along with the corresponding database migrations, service functions, API route handlers, and Zod validators. File storage integration for variant images is also configured in this sub-phase.

No user-facing UI is built here. The deliverable is a fully functional, fully tested backend API surface that the product management UI in SubPhase 02.02 will consume. By the end of this sub-phase, a developer should be able to create products with variants, adjust stock levels, run a stock take session through its full approval lifecycle, and query inventory valuations entirely through API calls.

---

## Scope

### In Scope

- Prisma model definitions for Category, Brand, Product, ProductVariant, StockMovement, StockTakeSession, and StockTakeItem
- All required enums: GenderType (MEN, WOMEN, UNISEX, KIDS, TODDLERS), TaxRule (STANDARD_VAT, SSCL, EXEMPT), StockMovementReason, and StockTakeStatus
- Database migration named "add_catalog_models" applied to the development PostgreSQL database
- Product service layer in src/lib/services/product.service.ts covering full CRUD, soft delete, archive toggling, and category/brand management
- Inventory service layer in src/lib/services/inventory.service.ts covering atomic stock adjustment, bulk adjustment, stock take session lifecycle, low stock queries, and stock valuation
- API route handlers for all product, variant, category, and brand endpoints as detailed in the Task List below
- Zod validation schemas for all request bodies and query parameters
- A unified file storage abstraction in src/lib/storage.ts supporting both Supabase Storage and Cloudinary, selected via the STORAGE_PROVIDER environment variable
- Prisma seed extension adding 30 sample products with realistic variants and stock levels to the development tenant

### Out of Scope

- Any product management UI (deferred to SubPhase 02.02)
- Stock control UI, including stock take session interface (deferred to SubPhase 02.03)
- POS barcode scanning integrated into the cart (deferred to Phase 03)
- Purchase order creation or supplier management (deferred to Phase 04)
- Elasticsearch or any full-text search upgrade (deferred to Phase 05)
- Webhook notifications for low stock events (deferred to Phase 05)

---

## Technical Context

### Data Model Relationships

The catalog data model forms a tree where Tenant is the root of all data isolation. Every model carries a tenantId foreign key to enforce multi-tenant boundaries at the database level. The following describes key relationships and design decisions.

Category supports self-referential nesting via a nullable parentId. This allows a two-level hierarchy such as "Clothing → Men's Shirts" without requiring a recursive CTE in the common case, since most queries only need the first-level category name for display.

Product always belongs to a Category and optionally belongs to a Brand. The Product record holds attributes that apply to all variants — name, gender classification, tax rule, and tags. It does not hold any pricing or stock quantity because those belong to individual variants.

ProductVariant carries all SKU-level attributes. The tenantId is stored directly on ProductVariant (redundant, since it can be derived from the parent Product) to avoid a JOIN on the high-frequency POS barcode lookup path. This is a deliberate denormalization for performance.

StockMovement is the immutable audit trail for every quantity change. It is never updated or soft-deleted. The quantityBefore and quantityAfter snapshots make each movement record self-contained — they remain meaningful even if the current stockQuantity on the variant has since changed.

StockTakeSession groups a set of counted items and drives an approval workflow. StockTakeItem is the per-variant counting record within a session. Discrepancy is stored explicitly rather than computed on read to simplify reporting queries.

### Permission Model

Cost price visibility is controlled by the product:view_cost_price permission. The service layer always fetches the full variant object including costPrice. The API Route Handler inspects the authenticated user's permissions and strips costPrice from the response if the permission is absent. The CASHIER role never holds this permission.

Stock take approval requires the stock:take:approve permission. This is validated inside the inventory service before transitioning a session to APPROVED.

All API routes require a valid authenticated session. Requests lacking a valid session receive a 401 response immediately, before any service function is called.

### Prisma Decimal Handling

All monetary values (costPrice, retailPrice, wholesalePrice) are declared as Decimal with the @db.Decimal(12,2) annotation, which maps to NUMERIC(12,2) in PostgreSQL. When performing arithmetic on these values in application code, the decimal.js library must be used. Direct JavaScript floating-point operations on monetary values are never permitted.

### Response Envelope Convention

All API responses in VelvetPOS use a standard envelope. A successful response contains a success field set to true and a data field holding the payload. A failed response contains a success field set to false and an error object with a code string and a human-readable message. HTTP status codes are also set appropriately (200, 201, 400, 401, 403, 404, 409, 500).

### File Storage

The STORAGE_PROVIDER environment variable must be set to either "supabase" or "cloudinary". The storage abstraction in src/lib/storage.ts reads this variable at runtime and delegates to the correct provider. Both providers receive a Buffer (not a readable stream) to remain compatible with the Next.js Route Handler request model, where FormData entries must be converted to Buffer via arrayBuffer() before uploading.

---

## Task List

| Task ID        | Task Name                              | Est. Complexity | Dependencies           |
| -------------- | -------------------------------------- | --------------- | ---------------------- |
| Task_02_01_01  | Create_Category_And_Brand_Models       | Low             | None                   |
| Task_02_01_02  | Create_Product_Model                   | Medium          | Task_02_01_01          |
| Task_02_01_03  | Create_ProductVariant_Model            | Medium          | Task_02_01_02          |
| Task_02_01_04  | Create_StockMovement_Model             | Medium          | Task_02_01_03          |
| Task_02_01_05  | Create_StockTakeSession_Models         | Medium          | Task_02_01_04          |
| Task_02_01_06  | Build_Product_Service_Layer            | High            | Task_02_01_03          |
| Task_02_01_07  | Build_Inventory_Service_Layer          | High            | Task_02_01_05          |
| Task_02_01_08  | Build_Category_And_Brand_API_Routes    | Low             | Task_02_01_06          |
| Task_02_01_09  | Build_Product_And_Variant_API_Routes   | High            | Task_02_01_06          |
| Task_02_01_10  | Setup_Product_And_Variant_Validators   | Medium          | Task_02_01_09          |
| Task_02_01_11  | Setup_File_Storage_Integration         | Medium          | None (parallel)        |
| Task_02_01_12  | Seed_Sample_Product_Catalog            | Medium          | Task_02_01_06          |

---

## Validation Criteria

- [ ] All catalog migrations run successfully on a fresh PostgreSQL database with no errors
- [ ] Running pnpm tsc --noEmit produces zero type errors across the entire codebase
- [ ] GET /api/products returns an empty data array with success true for a newly provisioned tenant that has no products
- [ ] POST /api/products with a valid body creates a product record with the correct tenantId derived from the authenticated session — never from the request body
- [ ] POST /api/products with an invalid or incomplete body returns a 400 status with a descriptive error envelope including field-level validation messages
- [ ] GET /api/variants/barcode/[barcode] returns a 404 response for a barcode that does not exist in the tenant's catalog
- [ ] Calling adjustStock in inventory.service creates exactly one new StockMovement record and updates the ProductVariant stockQuantity atomically
- [ ] Attempting to adjust stock to a quantity below zero returns a validation error from the service, leaving the variant stock unchanged and no StockMovement created
- [ ] An unauthenticated HTTP request to any /api/products route returns a 401 status
- [ ] A request authenticated as a CASHIER role to GET /api/products returns variant data without the costPrice field present in the response
- [ ] The seed script creates at least 30 products with variants and assigns stock quantities, with some variants intentionally below their lowStockThreshold
- [ ] The uploadFile function in src/lib/storage.ts correctly routes to the configured provider based on STORAGE_PROVIDER and returns a public URL string

---

## Files Created / Modified

- prisma/schema.prisma — Modified: all catalog models and enums added
- prisma/migrations/ — New migration directory for the catalog migration
- src/lib/services/product.service.ts — Created
- src/lib/services/inventory.service.ts — Created
- src/lib/validators/product.validators.ts — Created
- src/lib/validators/variant.validators.ts — Created
- src/lib/validators/category.validators.ts — Created
- src/lib/storage.ts — Created
- src/app/api/products/route.ts — Created
- src/app/api/products/[id]/route.ts — Created
- src/app/api/variants/[id]/route.ts — Created
- src/app/api/variants/barcode/[barcode]/route.ts — Created
- src/app/api/categories/route.ts — Created
- src/app/api/categories/[id]/route.ts — Created
- src/app/api/brands/route.ts — Created
- src/app/api/brands/[id]/route.ts — Created
- prisma/seed.ts — Modified: catalog seeding section added
