# Task 03.02.06 — Build Sale API Routes

## Metadata

| Field | Value |
|---|---|
| Task | 03.02.06 |
| Name | Build Sale API Routes |
| Sub-Phase | 03.02 — Payments, Receipts & Offline Mode |
| Complexity | High |
| Depends On | Task_03_02_02 |
| Produces | src/app/api/sales/route.ts, src/app/api/sales/[id]/route.ts, src/app/api/sales/[id]/void/route.ts, src/app/api/sales/[id]/receipt/route.ts, src/lib/validation/sale.schema.ts |

## Objective

Build the complete set of sale-related API routes: creating a sale with atomic persistence (POST /api/sales), listing sales with filters and pagination (GET /api/sales), fetching a single sale in full detail (GET /api/sales/[id]), voiding a sale (PATCH /api/sales/[id]/void), and serving the thermal receipt as a rendered HTML page (GET /api/sales/[id]/receipt).

## Instructions

### Step 1: Define the CreateSaleSchema with Zod

Create the file src/lib/validation/sale.schema.ts. This file contains the Zod schema used to validate the POST /api/sales request body. Export it as CreateSaleSchema.

The top-level object fields are: shiftId (string, required, non-empty), lines (array of line item objects with at least one element), cartDiscountPercent (number, optional, minimum 0, maximum 100, defaults to 0 if omitted), authorizingManagerId (string, optional — required by the business rules when a cart-level discount exceeds a configurable threshold, but optional from the schema's perspective), paymentMethod (Zod enum with three string literals: "CASH", "CARD", "SPLIT"), cashReceived (number, optional), cardReferenceNumber (string, optional, maximum 20 characters), and cardAmount (number, optional).

Each element of the lines array is an object with: variantId (string, required, non-empty), quantity (integer via z.number().int(), minimum 1), unitPrice (number, positive), and discountPercent (number, optional, minimum 0, maximum 100).

Apply a .superRefine() call to the top-level object to enforce cross-field payment validation. The superRefine function receives the parsed data and a Zod refinement context object. Apply the following checks in order. If paymentMethod is "CASH": confirm cashReceived is present and strictly positive, adding a Zod issue on the cashReceived path if not, with the message "cashReceived is required for CASH payments and must be a positive number." If paymentMethod is "SPLIT": confirm both cardAmount and cashReceived are present and strictly positive, adding Zod issues on their respective paths if either is missing or non-positive. No superRefine check is necessary for "CARD" because all card-specific fields are optional. The deeper invariant — that cardAmount plus the computed cashAmount equals the total from the lines — is not expressible in Zod without line total computation, so that validation is delegated entirely to sale.service.createSale.

Also export a GetSalesQuerySchema for the GET /api/sales query parameters: shiftId (string, optional), cashierId (string, optional), status (enum of "PENDING", "COMPLETED", "VOIDED", "ON_HOLD", optional), from (string, optional — ISO 8601 date string), to (string, optional — ISO 8601 date string), page (coerced number, minimum 1, default 1), and limit (coerced number, minimum 1, maximum 100, default 20).

Also export a VoidSaleSchema for PATCH /api/sales/[id]/void: reason (string, minimum 5 characters, required).

### Step 2: Build POST /api/sales

Create src/app/api/sales/route.ts as a Next.js App Router route file. The exported POST function handles sale creation.

Begin by extracting the authenticated session using the project's auth utility. If no session is present, return a 401 response in the standard ApiResponse error envelope with the message "Unauthenticated." Extract tenantId and userId from the session.

Parse the request body as JSON and validate it against CreateSaleSchema using schema.safeParse. If validation fails, return a 400 response with the Zod error details in the standard envelope's error field. Do not expose internal stack traces.

Call sale.service.createSale passing the validated data plus the session-derived tenantId (as the owning tenant) and userId (as the cashierId). The service handles the full atomic transaction. If the service throws a domain-specific error about an OPEN shift not being found, return 409. If it throws a stock-insufficiency or invalid-variant domain error, return 422 with a descriptive message. If any unexpected error occurs, log it server-side and return 500 with a generic "An unexpected error occurred" message.

If the request body includes a queued_at field (indicating this is an offline-queued sale being synced), check the staleness: if the ISO timestamp in queued_at is more than the configured threshold (read from process.env.OFFLINE_SALE_STALE_HOURS as a number, defaulting to 4) hours in the past, return 410 Gone with the message "This offline sale payload has expired and will not be processed. Please contact your manager." Log the stale payload details at the warning level.

On success, return a 201 response with the created sale in the standard envelope. The sale object in the response must include the id, status, totalAmount, paymentMethod, all SaleLine records with their snapshots, all Payment records, and the shift reference.

### Step 3: Build GET /api/sales

In the same route.ts file, export a GET function for listing sales. Parse the URL search params and validate them against GetSalesQuerySchema. Return 400 on validation failure. Check that the authenticated user has either pos:access permission or stock:view permission for the tenant using the project's RBAC utility — return 403 if neither is present.

Call sale.service.getSales with the parsed filters and tenantId. Return the paginated results in the standard ApiResponse envelope with a meta field containing the total count, current page, and total pages.

### Step 4: Build GET /api/sales/[id]

Create src/app/api/sales/[id]/route.ts. The exported GET function reads the id param from the route context. Validate the session. Call sale.service.getSaleById passing the saleId and the tenantId from the session. The service must validate that the sale belongs to that tenantId — if it does not, treat it as not found. Return 404 with the message "Sale not found." if the service returns null.

The response data for a found sale includes the full sale record plus its SaleLines (with productNameSnapshot and variantDescriptionSnapshot), its Payment records (all legs), the cashier user's id and name, the shift id and openedAt timestamp, and the Tenant name for the receipt. Return this in the standard 200 envelope.

### Step 5: Build PATCH /api/sales/[id]/void

In the same [id]/route.ts file, export a PATCH function with the route logic for voiding a sale. Parse and validate the request body against VoidSaleSchema. Return 400 on validation failure.

Check that the authenticated user holds the pos:void_sale permission in the tenant using the RBAC utility. Return 403 with the message "You do not have permission to void sales." if the check fails.

Fetch the sale to confirm its current status. If the sale is already VOIDED or REFUNDED, return 409 with the message "This sale has already been voided or refunded and cannot be voided again." Call sale.service.voidSale with the saleId, tenantId, the authenticated userId, and the reason string. The service updates Sale.status to VOIDED, sets voidedAt to the current timestamp, stores the voidReason, and writes an AuditLog entry. Return the updated sale in the standard 200 envelope.

### Step 6: Build GET /api/sales/[id]/receipt

Create src/app/api/sales/[id]/receipt/route.ts. The exported GET function returns raw HTML, not JSON. Its Content-Type header must be "text/html; charset=utf-8".

Validate the session. Fetch the sale by id and tenantId using sale.service.getSaleById. Return a 404 HTML page (a minimal HTML document with "Receipt not found" text) if the sale does not exist. Fetch the Tenant record to obtain the store name, address, phone, and thankYouMessage.

Call buildThermalReceiptHtml(sale, tenant, cashierName) from src/lib/receipt-renderer.ts (which is created in Task 03.02.08). Return the resulting HTML string as a new Response object with the text/html content type and the headers Cache-Control set to "no-store, no-cache" and Content-Security-Policy set to "default-src 'none'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'unsafe-inline'". The script-src 'unsafe-inline' is required solely for the window.print() auto-print script embedded in the receipt HTML.

### Step 7: Standard Envelope and Error Discipline

All JSON routes use the project's ApiResponse wrapper type. Error responses never expose raw Prisma error messages, database identifiers, or stack traces. Every catch block logs the full error server-side using the project's logger and returns only a sanitised message to the client. This is mandatory for OWASP A05 (Security Misconfiguration) compliance.

For consistency, all route files import the shared buildApiResponse and buildApiError utilities (or equivalent helpers already established in the codebase) rather than constructing Response objects with raw JSON.stringify calls.

## Expected Output

- src/lib/validation/sale.schema.ts created with CreateSaleSchema, GetSalesQuerySchema, and VoidSaleSchema.
- src/app/api/sales/route.ts created with POST (create sale) and GET (list sales) handlers.
- src/app/api/sales/[id]/route.ts created with GET (sale detail) and PATCH (void sale) handlers.
- src/app/api/sales/[id]/receipt/route.ts created as an HTML-returning route stub (final renderer added in Task 03.02.08).

## Validation

- POST /api/sales with a valid CASH payload creates one Sale and one CASH Payment record, confirms the 201 response.
- POST /api/sales with a valid SPLIT payload creates one Sale and two Payment records (one CASH, one CARD), confirms the 201 response.
- POST /api/sales with paymentMethod "CASH" but without cashReceived returns 400 with a Zod validation error.
- GET /api/sales returns a paginated list with the correct total count and sale objects.
- GET /api/sales/[id] with a sale id belonging to a different tenant returns 404 (no cross-tenant data exposure).
- PATCH /api/sales/[id]/void with a valid reason sets Sale.status to VOIDED and creates an AuditLog entry.
- PATCH /api/sales/[id]/void called a second time on an already-voided sale returns 409.
- GET /api/sales/[id]/receipt returns a 200 response with Content-Type text/html.

## Notes

- The sale.service.createSale function is the single source of truth for atomicity. The POST /api/sales route handler must not attempt to create any database records itself — it only validates input, delegates to the service, and maps the result to an HTTP response.
- The queued_at staleness check in POST /api/sales is the server-side complement to the client-side staleness warning in useOfflineSync (Task 03.02.11). Both sides must use the same threshold to avoid confusing edge cases where the client allows submission but the server rejects it.
- The receipt route (GET /api/sales/[id]/receipt) does not require the same RBAC check as the JSON routes — any authenticated user with access to the tenant can view a receipt. This is intentional: store managers reviewing a receipt on a customer's behalf should not be blocked by cashier-specific permissions.
