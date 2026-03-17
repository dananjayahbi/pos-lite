# Task 04.03.11 — Build Shift Petty Cash and Cash Movements

## Metadata

| Field | Value |
|---|---|
| Task ID | 04.03.11 |
| Task Name | Build Shift Petty Cash and Cash Movements |
| SubPhase | 04.03 — Hardware Integrations and Audit |
| Priority | Medium |
| Complexity | Medium |
| Estimated Effort | 2–3 hours |
| Depends On | CashMovement Prisma model (Phase 03), ShiftSession Prisma model, Z-Report page (SubPhase 03.01) |
| Produces | GET and POST /api/shifts/[id]/cash-movements, updated Z-Report page with petty cash section |

## Objective

Enable cashiers and managers to record petty cash disbursements and manual cash deposits during a shift, and display these movements in the Z-Report so that the expected cash-in-drawer figure is accurate at shift close.

## Context

The CashMovement model was defined in Phase 03 for this purpose. Its assumed fields are: id, shiftSessionId (foreign key to ShiftSession), tenantId, userId (the staff member who recorded the movement), type (enum: PETTY_CASH_OUT for money taken from the drawer for an expense, MANUAL_IN for cash deposited into the drawer), amount (Decimal), reason (String), createdAt. Adapt field names to match the actual Phase 03 schema.

Cash movement records affect the cash reconciliation at shift close. The expected cash in drawer is: opening float, plus all cash sales during the shift, minus all cash refunds processed, plus all MANUAL_IN movements, minus all PETTY_CASH_OUT movements. This formula must be reflected in the Z-Report totals.

## Instructions

### Step 1: Create the Cash Movements API Routes

Create src/app/api/shifts/[id]/cash-movements/route.ts handling both GET and POST methods.

The GET handler authenticates the session. Validates that the shift belongs to the session's tenantId (query the ShiftSession where id equals the path param and tenantId equals session.tenantId — return 404 if not found). Fetches all CashMovement records for the shift, ordered by createdAt ascending. Includes the related user (name only) for display. Returns an array of movements.

The POST handler authenticates the session (CASHIER and above are permitted — a cashier recording petty cash is a normal operation). Parses the request body for: amount (positive number, required), reason (string, required, max 200 characters), and type (must be "PETTY_CASH_OUT" or "MANUAL_IN"). Validates that the target shift is currently OPEN (not already closed) by checking ShiftSession.status. If the shift is closed, return a 409 with { error: "Cannot record cash movements on a closed shift" }. Creates the CashMovement record with the provided fields plus shiftSessionId from the URL param, tenantId from the session, and userId from the session. Returns the created record.

### Step 2: Create the Petty Cash Recording Form

Create a client component src/components/shift/RecordCashMovementForm.tsx. The form contains:

- A type selector: two large tile-style radio buttons side by side, labelled "Petty Cash Out" (money leaving the drawer, e.g., for a supply purchase) and "Cash In" (money deposited into the drawer). Style the selected tile with a terracotta border and sand background.
- An amount input: a numeric Input field labelled "Amount" with currency prefix (tenant currency symbol). The value must be a positive number.
- A reason text input: a text Input labelled "Reason" with placeholder text "e.g., Bought printer paper". Max 200 characters with a character counter below.
- A "Record Movement" Submit button.

The form calls a provided onSubmit callback with the form data on submission. The parent component handles the actual API POST and refresh. Disable the submit button and show a spinner while submission is in progress. Clear the form after a successful submission.

### Step 3: Update the Z-Report Page with a Petty Cash Section

On the Z-Report page (established in SubPhase 03.01, located at src/app/dashboard/[tenantSlug]/shift/[id]/z-report/page.tsx or similar), add a "Petty Cash Movements" section above the cash reconciliation totals panel.

The section renders a table of CashMovements for the shift. Fetch the movements via GET /api/shifts/[id]/cash-movements. The table columns are: Time (formatted as HH:mm), Type (styled badge: "Out" in red for PETTY_CASH_OUT, "In" in green for MANUAL_IN), Reason, Recorded By, and Amount (right-aligned, prefixed with minus for OUT and plus for IN).

Below the table, show a summary line: "Net Petty Cash: [sum]" where the sum is total MANUAL_IN amounts minus total PETTY_CASH_OUT amounts. If the net is negative (more was taken out than put in), show the amount in red.

If no movements exist for the shift, show an empty state: "No petty cash movements recorded for this shift."

Add a "+ Record Petty Cash" Button at the top-right of the section header. The button is only enabled when the shift is still OPEN. Clicking it opens a ShadCN Dialog containing the RecordCashMovementForm. After a successful submission, close the dialog, show a success toast, and re-fetch the movements list using TanStack Query's invalidateQueries for the movements query key.

### Step 4: Update Cash Reconciliation Totals

On the Z-Report page, locate the Expected Cash in Drawer calculation. Update it to incorporate cash movements:

The formula displayed in the reconciliation panel should read: Opening Float + Cash Sales Revenue − Cash Refunds Paid + Cash Deposited (MANUAL_IN total) − Petty Cash Out (PETTY_CASH_OUT total) = Expected Cash in Drawer.

Display each component of the formula as a labelled row in the reconciliation table. Highlight the Expected vs Actual variance row — show the variance in red if the actual cash counted is less than expected, and in green if it matches or exceeds expectations.

## Expected Output

- GET /api/shifts/[id]/cash-movements listing all movements for a shift
- POST /api/shifts/[id]/cash-movements creating a new movement, rejecting requests on closed shifts
- RecordCashMovementForm component with type, amount, and reason fields
- Z-Report page updated with a Petty Cash Movements table and a "+ Record Petty Cash" dialog button
- Cash reconciliation totals updated to incorporate MANUAL_IN and PETTY_CASH_OUT in Expected Cash calculation

## Validation

- [ ] POST /api/shifts/[id]/cash-movements creates a CashMovement record with the correct shiftSessionId, tenantId, and userId
- [ ] POST /api/shifts/[id]/cash-movements returns 409 when the shift is CLOSED
- [ ] A CashMovement with amount less than or equal to 0 is rejected with a validation error
- [ ] The Z-Report petty cash section renders all movements with correct type badges and amounts
- [ ] Expected Cash in Drawer reflects MANUAL_IN as an addition and PETTY_CASH_OUT as a subtraction
- [ ] The "+ Record Petty Cash" button is disabled or hidden when the shift is already CLOSED
- [ ] After recording a movement via the dialog, the movements table refreshes without a full page reload

## Notes

- The reason field is mandatory and must not be empty. A shift auditor reviewing cash movements needs to understand why each movement occurred
- Amount validation should enforce a maximum per-movement cap at the API level. A default maximum of the tenant's currency unit ×10,000 is a reasonable safeguard against input errors. This cap does not need to be configurable in this phase
- If the Z-Report page is a Server Component, the petty cash section should be extracted into a client component that fetches data independently via TanStack Query, since it needs to refetch after the record-movement action
