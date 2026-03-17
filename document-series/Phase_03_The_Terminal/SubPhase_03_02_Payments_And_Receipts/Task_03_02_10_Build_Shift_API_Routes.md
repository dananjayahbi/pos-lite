# Task 03.02.10 — Build Shift API Routes

## Metadata

| Field        | Value                                         |
|--------------|-----------------------------------------------|
| Sub-Phase    | 03.02 — Payments, Receipts and Offline Mode   |
| Phase        | 03 — The Terminal                             |
| Complexity   | Medium                                        |
| Dependencies | SubPhase 03.01 complete (`shift.service` exists) |

---

## Objective

Expose the shift lifecycle management functions built in `shift.service` through RESTful HTTP endpoints, completing the server-side contract that the POS terminal frontend and the shift management UI require to open sessions, query the active session, close sessions with cash counts, and browse shift history.

---

## Instructions

### Step 1: Define the Shift Validation Schemas

Create the file `src/lib/validation/shift.schema.ts` if it does not already exist. Export the following Zod schemas from this file.

`OpenShiftSchema` validates the request body for `POST /api/shifts`. It has one required field: `openingCashFloat` (a number with minimum 0 and maximum 9,999,999.99 — the physical cash in the drawer at shift open). Add `.describe()` metadata on the field for API documentation generation purposes.

`CloseShiftSchema` validates the request body for `POST /api/shifts/[id]/close`. It has one required field: `closingCashCount` (a number with minimum 0 and maximum 9,999,999.99 — the physical cash count at shift close, after the cashier has counted the drawer). This value is used by `shift.service.closeShift` to compute the variance between expected and actual cash.

`GetShiftsQuerySchema` validates the query parameters for `GET /api/shifts`. Include: `cashierId` (string, optional), `status` (enum of `"OPEN"` and `"CLOSED"`, optional), `from` (string, optional — ISO date), `to` (string, optional — ISO date), `page` (coerced number, minimum 1, defaulting to 1), and `limit` (coerced number, minimum 1, maximum 100, defaulting to 20).

### Step 2: Build POST /api/shifts

Create `src/app/api/shifts/route.ts`. The exported `POST` function handles opening a new shift.

Validate the authenticated session. Return `401` if no session exists. Extract `tenantId` and `userId` (the cashier) from the session. Check that the authenticated user has the `pos:access` permission using the RBAC utility — return `403` with the message "You do not have permission to open a shift." if the check fails.

Parse and validate the request body against `OpenShiftSchema`. Return `400` with the Zod validation errors if validation fails.

Before calling the service, check for an existing OPEN shift for this cashier in this tenant using a `prisma.shift.findFirst` query with filters on `cashierId`, `tenantId`, and `status: "OPEN"`. If a record is found, return `409` (Conflict) with the error message "A shift is already open for this cashier. Please close the existing shift before opening a new one." Do not call `shift.service` in this case — the conflict check is performed at the route layer to return the most precise HTTP status code and avoid relying on a thrown service exception for flow control.

If no conflict exists, call `shift.service.openShift` with the `tenantId`, `cashierId`, and `openingCashFloat` (converted from the validated number to a Decimal). Return the newly created `Shift` record in the standard `201` `ApiResponse` envelope.

### Step 3: Build GET /api/shifts

In the same `route.ts` file, export a `GET` function for listing shifts. Validate the session. Check for `pos:access` or `manager:reports` permission — managers must be able to view shift lists for reporting purposes, so `pos:access` alone is not sufficient as an exclusive gate. Return `403` if neither permission is held.

Parse the URL search parameters and validate them against `GetShiftsQuerySchema`. Return `400` on validation failure.

Pass the validated filters and the session's `tenantId` to `shift.service.getShifts`. The service applies all filters and returns a paginated result. Return the results in the standard `200` envelope with the `meta` pagination object containing `total`, `page`, and `totalPages`.

Apply the tenant isolation rule explicitly: even if the authenticated user has manager-level access, the query must always be scoped to the session's `tenantId`. A super-admin accessing this route through the superadmin interface uses a separate admin route, not this one.

### Step 4: Build GET /api/shifts/current

Create `src/app/api/shifts/current/route.ts`. The exported `GET` function retrieves the currently OPEN shift for the authenticated cashier.

Validate the session. Return `401` if absent. Check for `pos:access`. Return `403` if absent.

Call `shift.service.getCurrentShift` with the `tenantId` and the session's `userId`. The service returns the single `Shift` with `status: "OPEN"` belonging to the authenticated cashier in the given tenant, or null if none exists.

If null is returned, respond with `200` and a `null` data field in the standard envelope — do not return `404`. The absence of an open shift is not an error condition; it is the expected state before a cashier opens their first shift of the day. The frontend uses the `null` case to redirect the cashier to the shift-open screen.

If a shift is found, include the full `Shift` record in the response data, including `openedAt`, `openingCashFloat`, `status`, and any nested sale count if the service provides it.

### Step 5: Build POST /api/shifts/[id]/close

Create `src/app/api/shifts/[id]/close/route.ts`. The exported `POST` function handles shift closure.

Validate the session. Return `401` if absent. Extract `tenantId` and `userId`.

Read the `id` param from the route context. Fetch the `Shift` record by `id` with a `tenantId` filter. If not found, return `404` with the message "Shift not found." If the shift's `status` is already `"CLOSED"`, return `409` with the message "This shift has already been closed."

Check whether the authenticated user has permission to close this specific shift. The rule: a cashier may close only their own shift (where `shift.cashierId` equals `session.userId`); a user with the `manager:shifts` permission may close any cashier's shift within the same tenant. Return `403` with the message "You do not have permission to close this shift." if neither condition is satisfied.

Parse and validate the request body against `CloseShiftSchema`. Return `400` on validation failure.

Call `shift.service.closeShift` with the `shiftId`, the `closingCashCount` Decimal value, the `tenantId`, and the `userId` (for audit purposes). The service closes the shift by setting `status` to `"CLOSED"`, setting `closedAt` to the current timestamp, creating the `ShiftClosure` record with variance calculation, and voiding any sales with status `ON_HOLD` that belong to the shift being closed (held sales are automatically abandoned when a shift closes).

On success, return the updated `Shift` record with its nested `ShiftClosure` in the standard `200` envelope.

### Step 6: Build GET /api/shifts/[id]

In the same `[id]` route file, export a `GET` named function for retrieving a single shift in full detail. This handler requires the route file to be structured as `src/app/api/shifts/[id]/route.ts` (a combined file with both `GET` and potentially a future `PATCH` handler).

Validate the session. Check for `pos:access` or `manager:reports`. Return `403` if neither is held.

Fetch the `Shift` record by `id` scoped to the session's `tenantId`. Include related data in the Prisma query: the nested `ShiftClosure` record (if present) and a count of associated sales grouped by status. If the shift is not found or does not belong to the tenant, return `404`.

The response data includes the full `Shift` object, the `ShiftClosure` (or null), the cashier's name (fetched by joining the `userId` of the shift to the `User` table), and the sale counts by status (`COMPLETED`, `VOIDED`, `ON_HOLD`). Return this in the `200` envelope.

### Step 7: RBAC and Tenant Isolation Summary

For completeness, document the permission model across all shift routes in a comment block at the top of each route file. The rules are:

- `POST /api/shifts` — requires `pos:access`. Scoped to the authenticated user's own `cashierId`.
- `GET /api/shifts` — requires `pos:access` OR `manager:reports`. Always scoped to session `tenantId`.
- `GET /api/shifts/current` — requires `pos:access`. Returns only the authenticated user's own open shift.
- `POST /api/shifts/[id]/close` — requires `pos:access` (own shift) OR `manager:shifts` (any shift). Always scoped to session `tenantId`.
- `GET /api/shifts/[id]` — requires `pos:access` OR `manager:reports`. Always scoped to session `tenantId`.

These rules mean a cashier cannot see or close another cashier's shift unless they have been granted a manager role. A manager cannot close a shift belonging to a different tenant. Super-admin access to shifts uses a separate admin-prefixed API route namespace.

---

## Expected Output

- `src/lib/validation/shift.schema.ts` created with all three Zod schemas exported.
- `src/app/api/shifts/route.ts` created handling `POST` (open) and `GET` (list).
- `src/app/api/shifts/current/route.ts` created handling `GET` (current active shift).
- `src/app/api/shifts/[id]/route.ts` created handling `GET` (detail view).
- `src/app/api/shifts/[id]/close/route.ts` created handling `POST` (close shift).
- All routes enforce authentication, RBAC, and `tenantId` scoping.

---

## Validation

- Call `POST /api/shifts` with a valid `openingCashFloat` while authenticated as a cashier — confirm a new `Shift` record is created with `status: "OPEN"`.
- Call `POST /api/shifts` again for the same cashier without closing the first shift — confirm a `409` response is returned.
- Call `GET /api/shifts/current` — confirm the OPEN shift is returned.
- Call `POST /api/shifts/[id]/close` with a valid `closingCashCount` — confirm the shift status changes to `"CLOSED"` and a `ShiftClosure` record is created.
- Call `GET /api/shifts/current` after closure — confirm the response returns `null` data.
- Call `GET /api/shifts/[id]` with the closed shift's id — confirm the response includes the `ShiftClosure` and sale counts.
- Call `POST /api/shifts/[id]/close` again on the already-closed shift — confirm a `409` response.
- Attempt to close another cashier's shift as a cashier (non-manager) — confirm a `403` response.

---

## Notes

- The `closingCashCount` value represents the raw cash counted by the cashier from the drawer. The variance (expected cash based on opening float plus completed cash sales, minus actual count) is computed entirely inside `shift.service.closeShift`. The route does not perform this arithmetic.
- On shift closure, any `ON_HOLD` sales are voided by the service. The void reason is automatically set to "Shift closed with held sale outstanding" and an `AuditLog` entry is created for each voided sale. This automatic voiding is documented in the `ShiftClosure` record's `notes` field by the service.
- The `GET /api/shifts` route uses cursor-based or offset-based pagination depending on what `shift.service.getShifts` implements. Follow the established pagination pattern used by other list routes in the project.
- For the Sri Lankan retail context, shifts typically correspond to business-day sessions. A manager closing overnight shifts is a common scenario — hence the `manager:shifts` override permission on the close route.
