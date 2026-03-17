# Task 03.03.07 — Build Return API Routes

## Metadata

| Field          | Value                                                            |
| -------------- | ---------------------------------------------------------------- |
| Task ID        | 03.03.07                                                         |
| Name           | Build Return API Routes                                          |
| SubPhase       | 03.03 — Returns and Exchanges                                    |
| Status         | Not Started                                                      |
| Complexity     | MEDIUM                                                           |
| Dependencies   | Task_03_03_02 complete (return.service.ts)                       |
| Output Files   | src/app/api/returns/route.ts, src/app/api/returns/[id]/route.ts, src/app/api/sales/[id]/route.ts (modified to include returnedAlready per line) |

---

## Objective

Build the HTTP API layer for the returns subsystem. These routes expose `return.service.ts` to the client, enforce tenant scoping, validate all inputs with Zod, and return standardized response envelopes consistent with the rest of the VelvetPOS API.

---

## Context

Return API routes are security-sensitive. Any authenticated user can read return records for their tenant, but only users with Manager role or above can create them (via the `authorizedById` field — even if a Cashier initiates the UI flow, the POST body must include a valid `authorizedById`). The authorization check at the server does not duplicate the Manager PIN verification — PIN verification is performed client-side via the `POST /api/auth/verify-pin` endpoint. The return API trusts that the `authorizedById` passed in the body refers to a real Manager or above user in the tenant, and validates this.

---

## Instructions

### Step 1: Create the Zod Validation Schema

Create a Zod schema `ReturnCreateSchema` in a shared file such as `src/lib/validators/return.validator.ts`. The schema validates:

- `originalSaleId`: non-empty string
- `lines`: array with at least one element, each containing `saleLineId` (string), `variantId` (string), and `quantity` (positive integer)
- `refundMethod`: must be one of the `ReturnRefundMethod` enum values
- `restockItems`: boolean, defaults to `true`
- `reason`: optional string, max 200 characters
- `authorizedById`: non-empty string
- `cardReversalReference`: optional string, max 50 characters — required when `refundMethod` is `CARD_REVERSAL`, enforced via `.superRefine`
- `linkedReturnId`: optional string — only expected when `refundMethod` is `EXCHANGE` but not validated server-side in Phase 03

Add a `.superRefine` check that throws a Zod error on the `cardReversalReference` field with message "Reversal reference number is required for card reversals" when `refundMethod === CARD_REVERSAL` and `cardReversalReference` is empty or undefined.

### Step 2: Build POST /api/returns

Create `src/app/api/returns/route.ts`.

In the POST handler:
1. Get the session with `getServerSession(authOptions)`. Return 401 if not authenticated.
2. Extract `tenantId` from the session or from a `tenantSlug` header resolved to a tenantId.
3. Parse and validate the request body with `ReturnCreateSchema`. Return a 400 with Zod error details if validation fails.
4. Verify that the `authorizedById` user exists, belongs to the same tenant, and has role MANAGER, OWNER, or SUPER_ADMIN. Return 403 with "Authorizing user is not a manager in this tenant" if not.
5. Call `return.service.initiateReturn` with the validated data and `tenantId`.
6. Return a 201 response with the envelope `{ success: true, data: returnRecord }`.
7. Catch service-layer errors (return window expired, over-quantity) and return 422 with `{ success: false, error: errorMessage }`.
8. Catch unexpected errors and return 500.

### Step 3: Build GET /api/returns

In the same `route.ts` file, add a GET handler.

Query parameters:
- `originalSaleId` — optional filter
- `refundMethod` — optional filter
- `from` — optional ISO date string
- `to` — optional ISO date string
- `page` — integer, defaults to 1
- `limit` — integer, defaults to 25, max 100

Validate and parse query params. Call `return.service.getReturns` with `tenantId` and the filters. Return `{ success: true, data: returns, pagination: { total, page, limit, totalPages } }`.

### Step 4: Build GET /api/returns/[id]

Create `src/app/api/returns/[id]/route.ts`.

GET handler: resolve `returnId` from `params.id`. Call `return.service.getReturnById(tenantId, returnId)`. Return 404 if not found. Return 200 with the full return record including lines, original sale, and user references.

### Step 5: Update GET /api/sales/[id] to Include returnedAlready

Update the existing sale detail endpoint to include, for each `SaleLine`, a computed `returnedAlready` field. This is the sum of all `ReturnLine.quantity` values from COMPLETED Returns for that `SaleLine.id`. This field is used by the Return Item Selection Panel (Task_03_03_04) to determine remaining returnable quantities per line.

The computation can be done efficiently using a Prisma query that includes `ReturnLine` grouped by `saleLineId` via a `_count` or via a raw aggregation in a single query. Alternatively, fetch all `ReturnLine` records for the sale's lines and compute client-side in the API route before responding.

---

## Expected Output

- POST /api/returns creates returns and returns 201 with the full Return record
- GET /api/returns returns paginated returns for the tenant
- GET /api/returns/[id] returns a single full return
- GET /api/sales/[id] is updated to include `returnedAlready` per SaleLine

---

## Validation

- POST /api/returns with `refundMethod: CARD_REVERSAL` and no `cardReversalReference` returns 400
- POST /api/returns with a `authorizedById` that is a CASHIER role returns 403
- POST /api/returns with a sale older than 30 days returns 422 with the window message
- GET /api/returns returns only returns belonging to the authenticated tenant
- GET /api/sales/[id] response now includes `returnedAlready` on each sale line

---

## Notes

The `POST /api/auth/verify-pin` endpoint is documented in Task_03_03_09. The return routes do not call verify-pin — PIN verification is client-only. The server validates the authorizedById identity and role. This separation is intentional: the PIN is a UX-level authorization prompt; the server-side role check is the security enforcement.
