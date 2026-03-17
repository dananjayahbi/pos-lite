# Task 03.01.02 — Create Shift And ShiftClosure Models

## Metadata

| Field | Value |
|---|---|
| Task ID | 03.01.02 |
| Task Name | Create Shift And ShiftClosure Models |
| Sub-Phase | 03.01 — POS Core |
| Complexity | Low |
| Dependency | Task_03_01_01 |
| Estimated Schema Lines | ~50 |

## Objective

Add the Shift and ShiftClosure Prisma models to schema.prisma, introduce the ShiftStatus enum, define the required compound indexes, and run the database migration that makes the shift management layer available for service-layer implementation.

## Instructions

### Step 1: Review Schema State

Open prisma/schema.prisma and confirm the current state of the file after Task 03.01.01. Specifically, verify that the Sale model contains a shiftId field with a declared Prisma relation pointing to "Shift" — this is a forward reference that currently causes a schema validation error because the Shift model does not yet exist. Adding the Shift model in this task will resolve that forward reference and allow the schema to pass validation. Also confirm that the User model is present, as both Shift.cashierId and ShiftClosure.closedById are relations to User.

### Step 2: Add the ShiftStatus Enum

Add a new enum named ShiftStatus with two values. OPEN represents an active cashier work session that has been started and not yet closed — the cashier can process sales under an OPEN shift. CLOSED represents a finished session for which a ShiftClosure record has been written and all sales have been tallied. The transition from OPEN to CLOSED is one-way and permanent: a closed shift cannot be reopened. This immutability is enforced at the service layer.

### Step 3: Define the Shift Model

Add a new Prisma model named Shift. The id field is a String with a cuid default and serves as the primary key. The tenantId field is a String without a relation attribute, consistent with the tenant isolation pattern used throughout the codebase — service-layer queries always include a tenantId filter rather than relying on a database-level foreign key to the Tenant model.

The cashierId field is a String with a named relation to the User model identifying the cashier who owns this shift. Use a distinct relation name (for example "ShiftCashier") to avoid ambiguity if additional User relations are added to Shift later. The status field is a ShiftStatus enum with a default of OPEN. The openedAt field is a DateTime with default now, recording the exact moment the shift was started. The closedAt field is an optional DateTime that is populated by the closeShift service when the shift is finalised.

The openingFloat field is a Decimal with db.Decimal(12,2) representing the amount of cash placed in the physical till at the start of the shift before any sales are made. This value anchors the expected cash calculation performed at shift close. The notes field is an optional String where the cashier or an overseeing manager may log any remarks about the shift, such as till anomalies or equipment issues.

The sales relation links to all Sale records belonging to this shift, enabling eager-loading of shift sales for reporting. The closure relation links to the optionally present ShiftClosure record — this relation will be null on an OPEN shift and present once the shift is closed.

Regarding enforcement of the single-open-shift-per-cashier rule: it might seem natural to add a database unique constraint on [cashierId, status] to prevent two OPEN shifts for the same cashier. However, this approach is not viable because a cashier will accumulate many CLOSED shifts over their tenure, and such a constraint would block the creation of any new shift after the first closure. Partial unique indexes (constrained to a specific enum value) are not expressible in Prisma's schema DSL in a cross-database manner. The rule is therefore enforced exclusively at the service layer: the openShift function always checks for an existing OPEN shift before creating a new one, throwing a ConflictError if one is found.

### Step 4: Define the ShiftClosure Model

Add a new Prisma model named ShiftClosure. The id field is a String with a cuid default. The shiftId field is a String with a @unique attribute and a relation to the Shift model; the unique constraint ensures that each Shift can have at most one ShiftClosure, preventing duplicate closure records from being created even under concurrent close requests.

The closingCashCount field is a Decimal with db.Decimal(12,2) representing the physical cash that was manually counted in the till at close time, as entered by the cashier or manager performing the reconciliation. The expectedCash field is a Decimal with db.Decimal(12,2) representing the theoretically correct till balance: openingFloat plus all cash received from sales during the shift, minus any cash paid out as refunds. This value is computed by the closeShift service and stored permanently at the moment of closure.

The decision to store expectedCash rather than recomputing it on every read is a deliberate audit safeguard. If a sale were subsequently voided after shift close — or if a bug were discovered in the aggregation query — a computed-on-read field would silently change historical reconciliation figures. Storing the value at closure time locks the expected amount permanently, ensuring the ShiftClosure record is a faithful snapshot of the financial state at the moment the drawer was counted.

The cashDifference field is a Decimal with db.Decimal(12,2) computed as closingCashCount minus expectedCash. A positive value indicates an overage (more cash than expected), while a negative value indicates a shortage. The totalSalesCount field is an Int counting all COMPLETED (non-voided) sales in the shift. The totalSalesAmount field is a Decimal with db.Decimal(12,2) summing the totalAmount of all COMPLETED sales. The totalReturnsCount and totalReturnsAmount fields are an Int and Decimal respectively; they store return data that will be populated by SubPhase 03.03 and must be set to 0 in Phase 3. The totalCashAmount is a Decimal with db.Decimal(12,2) summing all CASH and cash-portion-of-SPLIT payments. The totalCardAmount is a Decimal summing all CARD and card-portion-of-SPLIT payments.

The closedById field is a String with a relation to the User model identifying the person who performed the close action. The closedAt field is a DateTime with default now.

### Step 5: Add Compound Indexes

For the Shift model, add the following indexes. A compound index on [tenantId, status] supports the primary access pattern of finding all OPEN or CLOSED shifts for a given tenant. A compound index on [cashierId, status] supports the getCurrentShift query, which must efficiently locate the single OPEN shift for a specific cashier. A compound index on [tenantId, openedAt] supports chronological shift listing in shift management views and reports.

### Step 6: Run the Migration

From the project root, run the Prisma migration command with the name "add_shift_and_closure_models". After the migration succeeds, run pnpm prisma generate to update the TypeScript client. Confirm that the Sale model's shiftId forward reference is now satisfied — the schema should validate without errors and the generated client should expose shift and shiftClosure as table-level properties on the db instance.

## Expected Output

- ShiftStatus enum with OPEN and CLOSED present in schema.prisma
- Shift model with all specified fields, the cashierId relation to User, the sales relation to Sale, and the closure relation to ShiftClosure
- ShiftClosure model with all financial summary fields, the unique shiftId constraint, and the closedById relation to User
- All compound indexes defined in the Shift model
- Migration file "add_shift_and_closure_models" applied to the development database
- Prisma client regenerated and all schemas validated without errors

## Validation

- Running pnpm prisma migrate status reports both migration files from Task 03.01.01 and this task as successfully applied with no pending state
- Opening Prisma Studio shows the Shift and ShiftClosure tables with correct columns including openingFloat, closedAt, and the unique constraint on ShiftClosure.shiftId
- Attempting to create a second ShiftClosure with the same shiftId throws a unique constraint violation, confirming the one-closure-per-shift rule is enforced at the database level
- The Sale model's shiftId relation to Shift is now satisfied — running pnpm prisma validate produces no errors
- The generated TypeScript types include ShiftStatus and ShiftClosure as named exports from the Prisma client namespace

## Notes

- The totalReturnsCount and totalReturnsAmount fields in ShiftClosure must be included now even though they will always be 0 in Phase 3. Adding them later would require a migration on a production database that may already contain ShiftClosure rows. Including them now avoids that operational risk entirely.
- Do not set @default(0) on closingCashCount. Although the default behaviour would be mathematically sensible (a zero opening means no cash was pre-loaded), forcing the caller to provide an explicit value prevents accidental nil-float shifts where the cashier forgot to enter the float amount. The service layer should require this field explicitly.
- The notes field on Shift serves a practical operational purpose: if a cashier notices the till is short at the start of a shift (perhaps the previous cashier left it unbalanced), they can record this before any sales, establishing a documented baseline discrepancy that is separate from the end-of-day reconciliation.
