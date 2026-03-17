# Task 02.01.09 — Build Product And Variant API Routes

## Metadata

| Property             | Value                                                        |
| -------------------- | ------------------------------------------------------------ |
| Sub-Phase            | 02.01 — Product & Variant Data Models                        |
| Phase                | 02 — The Catalog                                             |
| Estimated Complexity | High                                                         |
| Dependencies         | Task_02_01_06 (Product service layer), Task_02_01_10 (Validators — may be developed in parallel) |

---

## Objective

Create all product and variant API Route Handlers. These routes form the primary data API consumed by the product management UI (Phase 02.02) and the POS cart scanning flow (Phase 03). The barcode lookup endpoint in particular must be implemented for maximum performance and correctness.

---

## Instructions

### Step 1: Establish the Products Collection Route File

Create the file src/app/api/products/route.ts. This file handles GET (list products) and POST (create product). Both handlers follow the standard authentication pattern: call auth() and return 401 if no session is present. Extract tenantId and the user's permissions from the session.

For the GET handler, parse query parameters from the incoming NextRequest URL. The accepted query parameters are: search (string), categoryId (UUID string), brandId (UUID string), gender (one of the GenderType enum values), isArchived (boolean string — "true" or "false"), page (numeric string, default "1"), limit (numeric string, default "20"). Validate these query parameters using the ProductListQuerySchema from the validators module. If any query parameter fails validation, return a 400 envelope rather than crashing.

Call getAllProducts(tenantId, parsedFilters) from the product service. The response from the service is a raw Prisma result that includes costPrice on each variant. Before returning the response, apply cost price filtering: if the authenticated user's permissions do not include product:view_cost_price, strip the costPrice field from every variant object in every product record in the result. This filtering must be applied to the response object in JavaScript before serialising to JSON — it must not be done by modifying the Prisma query itself, to keep the service layer clean.

Return the filtered result in a success envelope with pagination metadata: { success: true, data: products, meta: { page, limit, total, totalPages } }.

### Step 2: Implement the POST /api/products Handler

In the same src/app/api/products/route.ts file, implement the POST handler. Check for the product:create permission and return 403 if absent.

Parse the JSON request body and validate it against the CreateProductSchema from the validators module. If validation fails, return a 400 envelope with Zod error details.

Call createProduct(tenantId, session.user.id, validatedData) from the service. The service returns the created Product record without variants.

Check if the validated body includes a variantDefinitions array (an optional array of variant input objects). If it does, call createProductVariants(tenantId, createdProduct.id, variantDefinitions) within the same request. If variant creation fails due to SKU conflicts or validation issues, the product has already been created at this point and cannot be rolled back unless a transaction wraps both operations. To keep the Route Handler simple in this phase, proceed with creating the product first and then the variants, and if variant creation fails, return a 207 Multi-Status response indicating partial success: the product was created but variants failed, with error details for each failed variant. This edge case can be improved with a full-transaction approach in Phase 02.02.

Return the created product with any successfully created variants in a 201 envelope.

### Step 3: Create the Product Detail Route File

Create the file src/app/api/products/[id]/route.ts. This file handles GET, PATCH, and DELETE.

The GET handler calls getProductById(tenantId, params.id). If the service throws a not-found error, return a 404 envelope. Apply the cost price permission filter to variants in the response if the user lacks product:view_cost_price. Return the filtered product in a 200 envelope.

The PATCH handler requires the product:edit permission. Parse and validate the body against UpdateProductSchema (a partial version of the create schema). Call updateProduct(tenantId, params.id, session.user.id, validatedData). Return the updated product in a 200 envelope.

The DELETE handler requires the product:delete permission. Call softDeleteProduct(tenantId, params.id, session.user.id). Return the soft-deleted product record in a 200 envelope with a note that the resource has been archived and can be restored by un-setting deletedAt through the admin API.

### Step 4: Create the Variant Detail Route File

Create the file src/app/api/variants/[id]/route.ts. This file handles GET and PATCH.

The GET handler fetches the variant by ID with tenant verification. Include the parent product's name and categoryId in the response. Apply cost price filtering. Return 404 if not found.

The PATCH handler requires the product:edit permission. Validate the body against UpdateVariantSchema. Call updateProductVariant(tenantId, params.id, session.user.id, validatedData). Return the updated variant in a 200 envelope.

### Step 5: Create the Barcode Lookup Route File

Create the file src/app/api/variants/barcode/[barcode]/route.ts. This is one of the most performance-sensitive endpoints in the entire application — it is called every time a cashier scans a barcode at the POS terminal.

The GET handler must:

First, validate the session and return 401 if absent. This check adds minimal latency and is non-negotiable for security.

Second, read the barcode from params.barcode. Validate that it is a string between 8 and 20 characters composed only of alphanumeric characters and hyphens — any other format should return a 400 immediately without touching the database, as it cannot match any stored barcode.

Third, call the product service's getVariantByBarcode function (add this function to product.service.ts): find a non-deleted ProductVariant where barcode equals the provided value and tenantId equals the session tenantId. Include the parent Product's name, gender, taxRule, and categoryId in the response so the POS cart can display the full product context.

Fourth, if no variant is found, return 404 with code "BARCODE_NOT_FOUND" and a message indicating the scanned barcode does not match any product in the system. The POS UI will display this message to prompt the cashier to check the item manually.

Fifth, apply cost price filtering: if the cashier role is present (or if the user lacks product:view_cost_price), strip costPrice from the response.

Sixth, return the variant with both its own data and the parent product data in a flat response structure in the success envelope. Flatten the nested product fields into the response object for ease of consumption by the POS cart frontend, rather than returning nested objects.

Performance target: this endpoint should complete within 50ms for 95% of requests. The [barcode, tenantId] composite index created in Task 02.01.03 is the primary enabler of this performance. If response times exceed 100ms consistently, investigate whether the index is being used with EXPLAIN ANALYZE.

### Step 6: Implement Consistent Error Handling Across All Route Files

Wrap all Route Handler bodies in try/catch. Handle the following error types explicitly:

Not-found errors (raised by the service when a record does not exist or belongs to a different tenant): return 404 with an appropriate code and message.

Validation errors (raised by the service for business rule violations like negative stock or duplicate SKU): return 400 with the error details.

Conflict errors (raised by soft-delete functions when dependencies exist): return 409.

For all other errors: log the full error server-side and return a 500 envelope with a generic message. Never expose Prisma error objects or stack traces to the API response.

### Step 7: Add Request Logging for the Barcode Endpoint

For the barcode lookup endpoint specifically, add a lightweight request log using the server-side console (or the logging utility from Phase 01 if one exists) to record each lookup: the barcode value (sanitised), whether it was a hit or miss, and the response time in milliseconds. This log helps identify patterns in missed barcodes (potential data entry issues or new products that need to be added to the catalog) and confirms the 50ms performance target is being met in production.

---

## Expected Output

- Four route files exist: src/app/api/products/route.ts, src/app/api/products/[id]/route.ts, src/app/api/variants/[id]/route.ts, src/app/api/variants/barcode/[barcode]/route.ts
- Cost price is stripped from responses for users without product:view_cost_price permission
- The barcode endpoint validates the barcode format before hitting the database
- The barcode endpoint returns 404 with BARCODE_NOT_FOUND for unrecognised barcodes
- Pagination metadata is included in GET /api/products responses
- POST /api/products supports optional inline variant creation

---

## Validation

- [ ] GET /api/products with no query params returns paginated product list with meta object
- [ ] GET /api/products?search=shirt returns only products with "shirt" in the name (case-insensitive)
- [ ] POST /api/products with invalid body returns 400 with field-level error details
- [ ] POST /api/products creates product and returns 201 with the created record
- [ ] GET /api/products/[id] returns 404 for a product ID belonging to a different tenant
- [ ] PATCH /api/products/[id] as a CASHIER role returns 403
- [ ] GET /api/variants/barcode/[barcode] returns 404 with BARCODE_NOT_FOUND for invalid barcode
- [ ] GET /api/variants/barcode/[barcode] with a valid barcode returns variant and parent product fields
- [ ] A CASHIER-authenticated response from any variant endpoint omits costPrice
- [ ] Barcode lookup with a non-alphanumeric barcode returns 400 without querying the database
- [ ] pnpm tsc --noEmit passes with no type errors in all four route files

---

## Notes

The cost price stripping logic must produce a clean response object — using JavaScript's object destructuring with rest syntax to exclude the costPrice property ensures the response does not include a costPrice key set to undefined (which some JSON serialisers will still include). The result should be verified by inspecting the raw JSON response body.

The barcode endpoint's 50ms performance target is achievable with the composite index but depends on two additional factors: the Next.js Route Handler itself adding no more than 5-10ms of framework overhead, and the PostgreSQL instance being co-located with or network-adjacent to the Next.js deployment. In a Vercel + Neon PostgreSQL configuration, connection pooling via PgBouncer (configured in the Neon connection string) is essential to avoid connection setup latency on each serverless function invocation.

The flatten approach on the barcode response is intentional for the POS frontend's convenience. The POS cart component should not need to navigate product.name, product.taxRule — it should find all necessary fields at the root of the response data object. This flattening is performed in the Route Handler, not in the service layer, maintaining the service's clean relational return type.
