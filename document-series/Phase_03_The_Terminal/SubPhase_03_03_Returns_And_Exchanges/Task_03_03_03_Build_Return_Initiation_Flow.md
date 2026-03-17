# Task 03.03.03 — Build Return Initiation Flow

## Metadata

| Field          | Value                                          |
| -------------- | ---------------------------------------------- |
| Task ID        | 03.03.03                                       |
| Name           | Build Return Initiation Flow                   |
| SubPhase       | 03.03 — Returns and Exchanges                  |
| Status         | Not Started                                    |
| Complexity     | MEDIUM                                         |
| Dependencies   | Task_03_03_02 complete                         |
| Output Files   | src/components/pos/ReturnWizardSheet.tsx, src/app/dashboard/[tenantSlug]/pos/(terminal)/history/page.tsx (modified) |

---

## Objective

Add a "Return Items" action to the Sale History page so cashiers can begin a return against any completed sale. The return flow is housed inside a `ReturnWizardSheet` — a ShadCN Sheet that slides in from the right — preventing the cashier from leaving the POS terminal context. Implement return eligibility checking before the sheet opens so that expired or fully-returned sales are clearly communicated in the UI before any dialog is opened.

---

## Context

Sale History was built in Task_03_01_12. This task modifies that page's action column and adds the multi-step wizard component. The wizard manages all state locally (React `useState`) and only commits data to the server in its final step when the Manager PIN is confirmed. With a 3-step structure, the cashier can back-navigate freely up to that point without altering the database.

A deliberate UX decision: the Sheet does not close automatically on external click when an in-progress return is loaded (Step 2 or Step 3 is active). The ShadCN Sheet's `onInteractOutside` handler should be overridden to warn instead of close. On Step 1, standard dismiss behavior is acceptable.

---

## Instructions

### Step 1: Add Eligibility Helper to Sale History Page

On the Sale History page (`history/page.tsx`), each row in the sales table already has an Actions column. Add logic to compute return eligibility for each row:

- Parse the `sale.createdAt` date and compare it to the current date. If the difference exceeds 30 days, mark the row as `returnWindowExpired: true`.
- Check whether all `SaleLine` quantities are fully returned by comparing the `SaleLine.quantity` against a `returnedQuantity` field that must now be included in the sale list API response. If every line has `returnedQuantity >= quantity`, mark the row as `fullyReturned: true`.
- The sale list GET endpoint at `/api/sales` should be updated to include per-line `returnedQuantity` in its response. This is a computed field derived by summing all associated `ReturnLine.quantity` values for each `SaleLine`.

### Step 2: Add the Return Button to the Actions Column

Replace or supplement the existing Info action button in each sale row with a "Return Items" button. Apply the following states:

- If `returnWindowExpired` is `true`: render a ShadCN `Tooltip` wrapping a disabled Button with label "Return — Window Expired". Tooltip content: "Sales older than 30 days cannot be returned."
- If `fullyReturned` is `true`: render a disabled Button with label "Fully Returned" and no tooltip.
- If the sale status is `VOIDED`: render a disabled Button with label "Voided — No Return".
- Otherwise: render an active Button that opens the `ReturnWizardSheet` with the selected sale's ID.

### Step 3: Create the ReturnWizardSheet Component

Create `src/components/pos/ReturnWizardSheet.tsx`. This component receives a `saleId` prop and an `open` / `onOpenChange` prop pair.

When the sheet opens, it immediately fetches the full sale (including sale lines and existing retruned quantities) via `useQuery(["sale", saleId], ...)` calling `GET /api/sales/[id]`. While loading, display a centered skeleton. If the fetch fails, display an inline error with a Retry button.

The component manages wizard state locally using `useState`:
- `step: 1 | 2 | 3` — current wizard step
- `selectedLines: { saleLineId, variantId, quantity, isRestocked }[]` — lines selected for return
- `refundMethod: ReturnRefundMethod` — defaults to CASH
- `cardReversalReference: string` — only relevant for CARD_REVERSAL
- `restockItems: boolean` — defaults to true
- `reason: string` — return reason
- `authorizingManagerId: string | null` — set in Step 3
- `authorizationTimestamp: number | null` — Unix timestamp of PIN verification

A step header renders at the top of the Sheet:
- Step 1: "Select Items to Return"
- Step 2: "Choose Refund Method"
- Step 3: "Manager Authorization"

A progress indicator (three numbered circles) visually shows the current step.

### Step 4: Wire Up Step Navigation

"Back" and "Next" buttons are rendered at the bottom of the Sheet content area.

- Step 1 → Step 2: the Next button reads "Next: Refund Options →" and is disabled if no line has a `quantity > 0` selected
- Step 2 → Step 3: the Next button reads "Next: Authorize →" and is always enabled
- Step 3 → Submit: the Next button reads "Process Return" and is enabled only when `authorizingManagerId` is set and the authorization timestamp is less than 5 minutes old
- Clicking Back from Step 2 returns to Step 1 without losing selections
- Clicking Back from Step 3 returns to Step 2

### Step 5: Implement onInteractOutside Guard

Override the Sheet's `onInteractOutside` and `onEscapeKeyDown` handlers. If `step >= 2`, prevent the default dismiss behavior and instead show a confirmation within the sheet: "You have an in-progress return. Are you sure you want to cancel?" with Cancel and Abandon Return buttons.

---

## Expected Output

- The Sale History page has a Return Items action button with three correct disabled states and one active state
- `ReturnWizardSheet.tsx` renders correctly with step indicators and navigation
- Sale data loads into the sheet via TanStack Query on open
- Navigation between steps preserves local state

---

## Validation

- Clicks on a fully-returned sale row show a disabled Fully Returned button
- Clicking Return on a valid sale opens the ReturnWizardSheet
- Backing from Step 2 to Step 1 preserves selected line quantities
- Attempting to close the sheet at Step 2 shows the confirmation prompt

---

## Notes

The three step components (Item Selection, Refund Options, and Manager PIN) are built in the next three tasks. This task only establishes the sheet skeleton and navigation shell. Use placeholder content for each step body until the step components are built.
