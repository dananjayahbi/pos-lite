# Task 03.01.04 — Build Shift Service Layer

## Metadata

| Field | Value |
|---|---|
| Task ID | 03.01.04 |
| Task Name | Build Shift Service Layer |
| Sub-Phase | 03.01 — POS Core |
| Complexity | Medium |
| Dependency | Task_03_01_02 |
| Output Files | src/lib/services/shift.service.ts, src/lib/validators/shift.validator.ts, src/app/api/shifts/route.ts, src/app/api/shifts/[id]/close/route.ts |

## Objective

Create the shift service module responsible for managing cashier work sessions: opening a new shift with a validated opening float, closing a shift with a computed cash reconciliation summary, retrieving the current open shift for a given cashier, and providing paginated shift history for the management console.

## Instructions

### Step 1: Establish Imports and Type Definitions

At the top of src/lib/services/shift.service.ts, import Prisma, the db client instance, and Decimal from decimal.js. Import the shared ConflictError, NotFoundError, and UnauthorizedError classes. Import the RBAC role check utility from the auth utilities in SubPhase 01.02. Define a TypeScript interface named CloseShiftInput containing closingCashCount (Decimal) and an optional notes string of up to 500 characters. Define a GetShiftsFilter interface with optional cashierId, status (ShiftStatus), from (Date), to (Date), page (integer), and limit (integer) fields.

### Step 2: Implement openShift

The openShift function accepts tenantId (string), cashierId (string), and openingFloat (Decimal). Its first operation is a guard query: it calls the database to find any Shift record where tenantId equals the provided tenantId, cashierId equals the provided cashierId, and status equals OPEN. If such a record is found, throw a ConflictError that includes the existing shift's id and its openedAt timestamp in the error message, so the caller can surface a contextually useful message to the cashier rather than a generic conflict notice.

If no open shift is found, create a new Shift record with tenantId, cashierId, status OPEN, openingFloat rounded to two decimal places, and openedAt set to the current timestamp. Return the newly created Shift. No transaction is needed here — this is a single atomic insert.

### Step 3: Implement closeShift

The closeShift function accepts tenantId (string), shiftId (string), actorId (string), and a CloseShiftInput object. This is the most complex function in the shift service and should be implemented carefully in the following sequence.

Begin by retrieving the Shift record filtering by both id and tenantId. Throw a NotFoundError if not found. Confirm the shift's status is OPEN; throw a ConflictError if it is already CLOSED, such as when a concurrent request has already closed the shift. Validate the actor's authorisation: if actorId does not equal the shift's cashierId, query the actor's TenantMembership record for the given tenantId and confirm the role is MANAGER or OWNER. If neither condition is satisfied, throw an UnauthorizedError.

Next, handle lingering OPEN (held) Sale records. Query all Sales with shiftId equal to this shift's id and status equal to OPEN. For each such sale, update its status to VOIDED, set voidedAt to now, and set a note value of "No-sale — shift closed" in an appropriate field. Although the Sale model does not have a freeform notes field, this note can be written into the AuditLog alongside the void action. This ensures no orphaned held sales remain associated with a closed shift.

Then aggregate all COMPLETED Sale records belonging to this shift to compute the ShiftClosure fields. Use a Prisma aggregate query to compute totalSalesCount (count of COMPLETED sales), totalSalesAmount (sum of totalAmount for COMPLETED sales), totalCashAmount (sum of totalAmount where paymentMethod is CASH), and totalCardAmount (sum of totalAmount where paymentMethod is CARD). Note that SPLIT payment breakdown into precise cash and card portions requires the detailed payment model introduced in SubPhase 03.02; in Phase 3, SPLIT payment totals are included in neither totalCashAmount nor totalCardAmount and are tracked only in totalSalesAmount. This limitation must be documented with a comment in the code.

Compute expectedCash using decimal.js: openingFloat plus totalCashAmount. This represents the theoretically correct till balance assuming all cash was accounted for. Compute cashDifference as closingCashCount minus expectedCash. Round both values to two decimal places. Set totalReturnsCount to 0 and totalReturnsAmount to Decimal(0) — these fields are reserved for SubPhase 03.03.

Finally, execute a Prisma transaction containing two writes: create the ShiftClosure record with all computed fields and closedById set to actorId; update the Shift record setting status to CLOSED and closedAt to now. Return an object containing both the updated Shift and the new ShiftClosure.

### Step 4: Implement getCurrentShift

The getCurrentShift function accepts tenantId and cashierId. It performs a findFirst query on the Shift table filtering by tenantId, cashierId, and status equal to OPEN. Return the shift record if found, or null if no open shift exists. This function is called by the POS terminal layout server component on every page load to determine whether the terminal should display the full POS interface or redirect to the ShiftOpenModal. Performance is important here — the function should not fetch the full sales list or compute any aggregates; return only the Shift record fields needed to confirm the open session.

### Step 5: Implement getShiftById

The getShiftById function accepts tenantId and shiftId. Retrieve the Shift record with both tenantId and id filters. Include the cashier User record (limited to id, name, and email), the closure ShiftClosure relation, and a count of associated Sale records. Additionally, run a Prisma aggregate to compute the total revenue (sum of Sale.totalAmount for COMPLETED sales within this shift). Assemble and return a composite response object containing all of these values. Throw a NotFoundError if the shift does not belong to the given tenant.

### Step 6: Implement getShifts

The getShifts function accepts tenantId and an optional GetShiftsFilter object. Build a Prisma where clause from the tenantId plus any provided filter values: cashierId (exact match), status (ShiftStatus enum), and a createdAt range if from or to are provided, applied to the openedAt field. Apply a page and limit for cursor-based pagination, defaulting to page 1 and a limit of 20 with a maximum of 100. Execute a findMany ordered by openedAt descending and a count query in parallel. Return both the shifts array (including a summary count of associated Sales per shift) and the total count.

### Step 7: Define the Zod Validators and API Routes

In src/lib/validators/shift.validator.ts, define OpenShiftSchema validating openingFloat as a non-negative number, and CloseShiftSchema validating closingCashCount as a non-negative number and optional notes as a string of maximum 500 characters.

Create src/app/api/shifts/route.ts handling GET (calls getShifts) and POST (validates the request body against OpenShiftSchema, then calls openShift with cashierId extracted from the session). Create src/app/api/shifts/[id]/close/route.ts handling POST (validates the body against CloseShiftSchema, then calls closeShift with actorId from the session). Authenticate all routes via NextAuth getServerSession and return 409 for ConflictError, 404 for NotFoundError, 403 for UnauthorizedError, and 422 for Zod validation failures.

## Expected Output

- src/lib/services/shift.service.ts with openShift, closeShift, getCurrentShift, getShiftById, getShifts all implemented and type-safe
- src/lib/validators/shift.validator.ts with OpenShiftSchema and CloseShiftSchema
- src/app/api/shifts/route.ts and src/app/api/shifts/[id]/close/route.ts
- The closeShift function correctly handles lingering OPEN sales, creating void records for each
- All monetary aggregations use decimal.js

## Validation

- Calling openShift twice for the same tenantId and cashierId without an intervening close throws a ConflictError on the second call, with the first shift's id referenced in the error message
- Calling closeShift with a shift that is already CLOSED throws a ConflictError
- Closing a shift with two OPEN (held) Sale records transitions both Sales to VOIDED
- The ShiftClosure's cashDifference equals closingCashCount minus expectedCash when tested with known input values
- getCurrentShift returns null for a cashier with no open shift and returns the Shift object for a cashier who has one
- getShifts with a status filter of CLOSED returns only closed shifts for the tenant

## Notes

- The SPLIT payment limitation in Phase 3's closeShift is an acknowledged gap. Document it clearly with an inline comment and a reference to SubPhase 03.02, where the detailed payment model (with explicit cashAmount and cardAmount fields on the payment record) will allow precise breakdown. The ShiftClosure.totalCashAmount and totalCardAmount fields will be recalculated correctly once the payment model is in place.
- The ShiftClosure record is immutable after creation by design. Do not implement any update or recalculate endpoint for ShiftClosure. If a reconciliation error is discovered after the fact, the correct approach is an AuditLog annotation — not a mutation of the closure record.
- The computation of expectedCash uses only the openingFloat and totalCashAmount. Cash refunds (cash paid out to customers for returns) will be factored in during SubPhase 03.03 when the returns system is built.
