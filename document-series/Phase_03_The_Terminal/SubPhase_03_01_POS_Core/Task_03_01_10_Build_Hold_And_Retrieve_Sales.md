# Task 03.01.10 — Build Hold And Retrieve Sales

## Metadata

| Field | Value |
|---|---|
| Task ID | 03.01.10 |
| Task Name | Build Hold And Retrieve Sales |
| Sub-Phase | 03.01 — POS Core |
| Complexity | Medium |
| Dependency | Task_03_01_08 |
| Output Files | src/components/pos/HoldSaleButton.tsx, src/components/pos/RetrieveHeldSalesSheet.tsx |

## Objective

Implement the hold-and-retrieve workflow that allows a cashier to pause an in-progress transaction, save the cart state to the database, clear the terminal for a new transaction, and later restore any held sale to continue processing it.

## Instructions

### Step 1: Understand the Hold Sale Data Model

A held sale in VelvetPOS is not a separate data model — it is a Sale record in the database with status OPEN and a null paymentMethod field. The sale's SaleLine records are written to the database at the moment of hold, creating a persistent, recoverable snapshot of the cart. This is important to understand because it means held sales have the same data completeness as completed sales, except they have no payment and no stock deduction.

Specifically, the following has NOT happened for a held sale: adjustStock has not been called, so inventory levels are unchanged. No StockMovement record with reason SALE has been created. The sale cannot be voided by the void service (void is only for COMPLETED sales). The sale can only be completed or abandoned (abandoned sales are voided automatically at shift close).

The SHORT_ID shown to the cashier for held sale retrieval is the first six characters of the sale's UUID id field, rendered in uppercase. For example, if the sale id is "clxyz123abc456xyz", the SHORT_ID displayed is "CLXYZ1". This provides a human-readable reference short enough to communicate verbally or to glance at quickly on a busy counter.

### Step 2: Build the HoldSaleButton Component

Create src/components/pos/HoldSaleButton.tsx as a client component. This button appears in the CartPanel action buttons area (above the Charge/Pay button) and is disabled when the cart is empty.

When clicked, the button performs the following actions in sequence. First, show a confirmation toast notification if any cart discount authorisation is active (authorizingManagerId is set), reminding the cashier that the manager authorisation does not automatically persist with the held sale — the manager will need to re-authorise when the sale is retrieved and payment is attempted. Second, initiate a POST request to POST /api/sales/hold, submitting the current cart state: the tenantId, shiftId (from the current shift context, passed as a prop or read from a context provider), cashierId (from the session), and the full items array including variantId, quantity, discountPercent, productNameSnapshot, variantDescriptionSnapshot, sku, and unitPrice for each item. Also submit the cartDiscountAmount or cartDiscountPercent.

The /api/sales/hold endpoint creates the Sale record with status OPEN, creates all SaleLine records, and returns the created sale's id and SHORT_ID. It does not call adjustStock. The endpoint reuses the sale.service.ts createHeldSale function (a simplified variant of createSale that skips stock validation, skips stock adjustment calls, and sets status to OPEN instead of COMPLETED). Alternatively, implement this directly as a specialised code path within createSale by treating the paymentMethod parameter as optional and omitting the adjustStock calls when paymentMethod is absent.

On a successful API response, call clearCart in the useCartStore to reset the terminal. Show a persistent ShadCN toast notification that reads "Sale held — Reference [SHORT_ID]. Tap Retrieve to continue it." in the success colour (#2D6A4F). The toast should persist for 8 seconds rather than the default 5 to ensure the cashier has time to note the reference. Update the "Retrieve" indicator badge in the CartPanel header to reflect the new count of held sales for the current shift.

Set the HoldSaleButton's loading state to true during the API call to prevent duplicate submissions. After the API call completes (either success or failure), restore the loading state to false. On failure, show a danger toast with the error message and do not clear the cart.

### Step 3: Build the RetrieveHeldSalesSheet Component

Create src/components/pos/RetrieveHeldSalesSheet.tsx as a client component. This component renders as a ShadCN Sheet sliding in from the right side of the viewport when opened. It is triggered by a "Retrieve" button in the CartPanel header. This button shows a small badge with the count of OPEN Sale records for the current shift when the count is greater than zero, creating a passive indicator that held sales are waiting.

When the sheet opens, fetch OPEN sales for the current shift by calling GET /api/sales?shiftId=[currentShiftId]&status=OPEN. Show a loading skeleton while the fetch is in progress. Render the results as a vertical list of held sale entries, ordered by createdAt descending (most recently held first).

Each held sale entry in the list is a clickable card with the following information. The card header shows the SHORT_ID (first 6 characters of the sale id, monospace JetBrains Mono font in espresso) on the left and a relative time label ("3 min ago", "Just now") on the right in mist Inter text. Below the header, show a summary line: the number of cart lines (for example "4 items") and the cart total ("Rs. 4,850.00") computed as the sum of all SaleLine.lineTotalAfterDiscount values. This gives the cashier enough information to identify which held sale belongs to which customer, even without seeing the full receipt.

Clicking a held sale entry triggers the retrieve flow. First, if the current CartPanel cart is not empty, show a ShadCN AlertDialog warning: "You have items in your current cart. Retrieving this sale will replace your current cart. Your current items will not be lost — they will be auto-held as a new sale." If the cashier confirms, hold the current cart silently (call POST /api/sales/hold for the current cart without user-facing confirmation) before proceeding. If the current cart is empty, proceed directly.

Load the held sale's lines into the cart by calling replaceCart in useCartStore, providing an items array reconstructed from the SaleLine records of the retrieved sale. Map each SaleLine's variantId, productNameSnapshot, variantDescriptionSnapshot, sku, unitPrice, quantity, and discountPercent (converting lineTotalBeforeDiscount/lineTotalAfterDiscount back to discountPercent by dividing discountAmount by lineTotalBeforeDiscount and multiplying by 100) back into the CartItem shape. Also restore the cartDiscountAmount or cartDiscountPercent from the sale's discountAmount field.

Store the retrieved sale's id in a local context or component state (for example in a currentRetrievedSaleId context provider) so the payment flow in SubPhase 03.02 can update the existing OPEN Sale record to status COMPLETED rather than creating a new Sale record.

After loading the cart, close the sheet and show a brief toast "Sale [SHORT_ID] restored to cart" in the success colour.

### Step 4: Handle Held Sales at Shift Close

This step is not a UI component — it is documentation of behaviour already implemented in shift.service.ts (Task 03.01.04). At shift close, the closeShift function queries all OPEN Sale records for the shift and updates each to VOIDED with the note "No-sale — shift closed". This must be confirmed to already be implemented in the shift service before this task is considered complete. If it is not, implement it now.

The cashier should be warned about outstanding held sales in the ShiftCloseModal (from Task 03.01.05): before showing the closing cash count input, the ShiftCloseModal queries the count of OPEN sales for the current shift. If the count is greater than zero, show an orange warning banner reading "You have [N] held sale(s) that will be cancelled when you close this shift. To avoid losing them, retrieve and complete or discard them before closing."

## Expected Output

- src/components/pos/HoldSaleButton.tsx integrating with POST /api/sales/hold, clearCart store action, and success toast with SHORT_ID
- src/components/pos/RetrieveHeldSalesSheet.tsx with OPEN sales list, cart conflict warning, replaceCart store action, and silent auto-hold of the current cart when needed
- ShiftCloseModal updated with a held-sales warning when OPEN sales exist for the shift
- The held sale's id preserved in component state for SubPhase 03.02 payment flow

## Validation

- Holding a sale with three items sends a POST /api/sales/hold request, creates the Sale record with status OPEN and three SaleLine records, clears the cart, and shows a toast with the SHORT_ID
- No StockMovement records are created when a sale is held — inventory is unchanged
- The Retrieve button in the CartPanel header shows a count badge when there are OPEN sales for the shift
- Clicking Retrieve opens the sheet listing all held sales with their short IDs, item counts, and totals
- Clicking a held sale entry with the cart empty loads all items back into the CartPanel correctly
- Clicking a held sale entry with existing items in the cart shows the AlertDialog; confirming silently holds the current cart and loads the selected held sale
- The ShiftCloseModal shows the held-sale warning when OPEN sales exist for the current shift

## Notes

- The "silent auto-hold" behaviour when retrieving a held sale while the cart is not empty is a deliberate UX decision: it ensures no in-progress work is ever silently discarded. The cashier always retains the ability to go back to whatever they were doing. This creates a natural queuing mechanism for busy counters where the cashier assists multiple customers simultaneously.
- A held sale's SaleLine records use the same snapshot fields as completed sales. This means that even if a product is renamed between the time the sale is held and the time it is retrieved, the held sale's items display the correct original names.
- The SHORT_ID display is intentionally only 6 characters to be easy to communicate verbally between a cashier and a supervisor. Do not use the full UUID anywhere in the cashier-facing UI.
