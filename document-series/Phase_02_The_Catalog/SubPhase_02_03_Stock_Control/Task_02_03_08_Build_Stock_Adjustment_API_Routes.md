# Task 02.03.08 — Build Stock Adjustment API Routes

## Metadata

| Field | Value |
|---|---|
| Task ID | 02.03.08 |
| Task Name | Build Stock Adjustment API Routes |
| Parent Sub-Phase | SubPhase_02_03 — Advanced Stock Control |
| Complexity | Medium |
| Dependencies | SubPhase_02_01 complete |
| Output Paths | src/app/api/stock/adjust/route.ts, src/app/api/stock/bulk-adjust/route.ts, src/app/api/stock/movements/route.ts, src/app/api/stock/valuation/route.ts, src/app/api/stock/low-stock/route.ts |

---

## Objective

Create all stock-related API route handlers that power the adjustment forms, movement history page, valuation view, and low stock widget. Each route must be authenticated, strictly permission-gated using the RBAC system from Phase 1, validated with Zod schemas, and respond with the standard VelvetPOS response envelope. All mutation routes must be idempotent-safe and protect against concurrent adjustment races using Prisma's atomic update operations.

---

## Instructions

### Step 1: Establish Shared Infrastructure

Before implementing individual routes, confirm the following shared utilities are in place. The withAuth higher-order wrapper or middleware that attaches the authenticated user's session to the request context must be working. The hasPermission utility that checks whether the authenticated user holds a given RBAC permission string must be importable from the auth library. The standard response envelope helper that produces { success: true, data: {...} } for successes and { success: false, error: { code: string, message: string } } for failures must be importable from a shared response utility. If any of these are missing, create minimal implementations before proceeding with route handlers.

### Step 2: Build POST /api/stock/adjust

Create src/app/api/stock/adjust/route.ts. This is a POST handler.

Authentication and permission: verify the session is active and the user holds the stock:adjust permission. Return 401 if unauthenticated, 403 if authenticated but lacking permission.

Request body shape and Zod validation: define a StockAdjustSchema that requires variantId as a non-empty string, quantityDelta as a non-zero integer (positive or negative, but not zero — zero-delta adjustments are meaningless), and reason as one of the valid StockMovementReason enum string values. The note field is optional and capped at 500 characters. The optional saleId, purchaseOrderId, and stockTakeSessionId fields are optional strings for linking the movement to another domain entity.

Tenant scoping: derive the tenantId from the authenticated session. Before calling the service, verify the variantId belongs to a ProductVariant that is within the authenticated user's tenant. Fetch the variant with product join to confirm tenant ownership. Return 404 if not found or if it belongs to a different tenant.

Service call: invoke inventory.service.adjustStock(tenantId, variantId, actorId, { quantityDelta, reason, note, saleId, purchaseOrderId, stockTakeSessionId }). The service handles the Prisma transaction for updating ProductVariant.stockQuantity, creating the StockMovement record, and creating any low-stock NotificationRecords.

Response: return { success: true, data: { movement: { id, quantityBefore, quantityAfter, quantityDelta, reason, createdAt }, variant: { id, sku, stockQuantity }, lowStockTriggered: boolean } }. The lowStockTriggered boolean allows the client to display the immediate warning toast described in Task_02_03_07.

Error handling: if the adjustment would result in a negative stock level, the service should throw a typed error. Catch this error in the route handler and return a 422 response with code "BELOW_ZERO_STOCK" and message "Adjustment would result in negative stock quantity. Current stock: X."

### Step 3: Build POST /api/stock/bulk-adjust

Create src/app/api/stock/bulk-adjust/route.ts. This route handles batch adjustments, primarily used by the stock take approval workflow.

Authentication and permission: same as the single adjust route — requires stock:adjust.

Request body validation: define a BulkAdjustSchema where the root is an object with an adjustments array containing up to 50 items. Each item has the same fields as the single adjust schema: variantId, quantityDelta, reason, and optional note. The Zod schema enforces array max length of 50 — bulk operations above this threshold must be split into multiple calls. Reject empty arrays with a 400 error.

Tenant scoping: before calling the service, validate that all variantIds in the batch belong to ProductVariants within the authenticated user's tenant. Perform this validation in a single Prisma findMany query rather than looping. If any variant is not found or belongs to another tenant, return a 400 error listing the invalid variant IDs.

Service call: invoke inventory.service.bulkAdjustStock(tenantId, actorId, adjustments). This service function wraps all adjustments in a single Prisma transaction.

Response: return { success: true, data: { adjustedCount: number, movements: [array of movement summaries], lowStockTriggeredVariantIds: [array of variant IDs that breached threshold] } }.

### Step 4: Build GET /api/stock/movements

Create src/app/api/stock/movements/route.ts. This route returns the paginated audit trail of stock movements.

Authentication and permission: requires stock:view.

Query parameter validation: parse and validate the following URL query parameters using a Zod schema. The from and to parameters are optional ISO date strings. The reason parameter is an optional comma-separated list of StockMovementReason enum values. The variantId parameter is an optional string. The productId parameter is an optional string. The actorId parameter is an optional string. The page parameter is a positive integer defaulting to 1. The limit parameter is a positive integer defaulting to 25 and capped at 100. The format parameter is the optional string "csv" to trigger the export path.

CSV export path: when format=csv is detected, skip pagination and return all matching records (up to a reasonable hard cap of 10,000 rows to protect the server), set the Content-Type header to text/csv and the Content-Disposition header to attachment with a filename derived from the date range. Write the records as CSV rows. Exclude cost price fields from the CSV regardless of permission.

Standard JSON path: query StockMovement records filtered by tenantId and the optional parameters. Join with ProductVariant (including its product name and category) and with the actor User for the display name. Cost price fields on the variant must be excluded from the response — movement history does not expose cost data through this route. Return { success: true, data: { movements: [...], total: number, page: number, limit: number } }.

### Step 5: Build GET /api/stock/valuation

Create src/app/api/stock/valuation/route.ts.

Authentication and permission: this route requires the product:view_cost_price permission. Without it, return 403 with code "COST_PRICE_RESTRICTED" and message "You do not have permission to view stock valuation data."

Service call: invoke inventory.service.getStockValuation(tenantId). This function aggregates stockQuantity × retailPrice for total retail value and stockQuantity × costPrice for total cost value, excluding archived products and deleted variants.

Response: return { success: true, data: { retailValue: number, costValue: number, estimatedMargin: number, estimatedMarginPercent: number, variantCount: number, categoryBreakdown: [{ categoryId, categoryName, variantCount, retailValue, costValue }], calculatedAt: ISO timestamp string } }.

### Step 6: Build GET /api/stock/low-stock

Create src/app/api/stock/low-stock/route.ts.

Authentication and permission: requires stock:view.

Query parameters: below is an optional positive integer. When provided, it overrides the per-variant threshold comparison — return variants where stockQuantity is less than or equal to the supplied value. When omitted, use the standard per-variant comparison where stockQuantity is less than or equal to the variant's own lowStockThreshold. The countOnly parameter is an optional boolean (default false) — when true, return only the count integer for the widget badge optimisation. Standard page and limit pagination parameters apply when countOnly is false.

When countOnly is true, return { success: true, data: { count: number } }.

When countOnly is false, return { success: true, data: { variants: [array of variant objects including product name, category, sku, size, colour, stockQuantity, lowStockThreshold, retailPrice], total: number, page: number, limit: number } }. Exclude costPrice from this response.

Sort order: default is by shortfall (lowStockThreshold minus stockQuantity) descending.

### Step 7: Apply Standard Error Handling Across All Routes

Each route handler must be wrapped in a try-catch block. All unhandled errors should be caught and returned as 500 responses with the standard error envelope: { success: false, error: { code: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred." } }. Never leak internal error messages, stack traces, or Prisma error codes to the client response body. Log the full error server-side using the application logger.

Zod validation failures should return 400 with the code "VALIDATION_ERROR" and a message that summarises the validation issues in user-readable form. Do not expose the raw Zod error object in the response.

---

## Expected Output

Five API route handler files implementing all stock-related API surface for this sub-phase. All routes are authenticated and permission-gated. All mutation routes validate input with Zod. All routes return the standard response envelope. The CSV export route correctly generates downloadable files.

---

## Validation

- Send a POST to /api/stock/adjust with a valid body as an authenticated MANAGER user. Confirm a 200 response with the movement data and the updated variant stockQuantity.
- Send the same POST without the stock:adjust permission (as a STOCK_CLERK). Confirm a 403 response.
- Send a POST to /api/stock/adjust with quantityDelta of 0. Confirm a 400 validation error.
- Send a POST to /api/stock/adjust with a quantityDelta that would result in negative stock. Confirm a 422 response with the BELOW_ZERO_STOCK error code.
- Send a GET to /api/stock/movements with reason=DAMAGED and confirm only DAMAGED records are returned.
- Send a GET to /api/stock/movements?format=csv and confirm a text/csv response with the correct Content-Disposition header.
- Send a GET to /api/stock/valuation as a user without product:view_cost_price. Confirm a 403 with COST_PRICE_RESTRICTED code.
- Send a GET to /api/stock/low-stock?countOnly=true and confirm the response is a plain count integer wrapped in the data envelope.

---

## Notes

- Prisma's atomic increment pattern using the update syntax with stockQuantity increment delta should be used inside the service layer transaction to avoid race conditions. Two concurrent adjustment requests must not produce incorrect stock levels — the atomic update ensures the database-level operation is safe even under concurrency.
- The variantId ownership check (verifying the variant belongs to the user's tenant) is a mandatory multi-tenancy security boundary. Never skip this check to save a database round-trip.
- The CSV export for movements has a 10,000 row cap to protect the server from memory exhaustion on extremely active stores. If the result count would exceed this, return the rows up to the cap and include a CSV header comment reading "# Note: This export is limited to 10000 most recent records. Adjust your date range for smaller exports."
