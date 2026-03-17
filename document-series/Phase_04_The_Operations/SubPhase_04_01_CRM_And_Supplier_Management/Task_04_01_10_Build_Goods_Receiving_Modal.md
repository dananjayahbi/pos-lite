# Task 04.01.10 — Build Goods Receiving Modal

## Metadata

| Field | Value |
|---|---|
| Task ID | 04.01.10 |
| Task Name | Build Goods Receiving Modal |
| SubPhase | 04.01 — CRM and Supplier Management |
| Complexity | Medium |
| Estimated Effort | 2–3 hours |
| Prerequisites | 04.01.08 (PO service with receivePOLines), 04.01.09 (PO detail page) |
| Output | `src/components/suppliers/GoodsReceivingModal.tsx`, PO detail page updated |

---

## Objective

Build the Goods Receiving Modal — a ShadCN Dialog opened from the PO Detail page whenever a staff member is ready to log the physical arrival of goods. The modal presents each outstanding PO line, allows the user to enter the quantity received in this session and the actual cost price paid, and submits the receiving record to the API. After submission it handles the optional cost-price update confirmation flow via a follow-up AlertDialog.

---

## Context

The modal is triggered by the "Receive Goods" button on the PO Detail page (Task 04.01.09), rendered when the PO is in `SENT` or `PARTIALLY_RECEIVED` status. The receiving API route calls `receivePOLines`, which wraps all stock and PO state changes in a `$transaction`. Because the service already updates `ProductVariant.costPrice` inside the transaction when `actualCostPrice` differs, the follow-up AlertDialog is informational only — it confirms to the manager that cost prices have changed rather than asking for permission to change them.

---

## Instructions

### Step 1: Define Component Props and Local State

Create `src/components/suppliers/GoodsReceivingModal.tsx` as a Client Component. The component accepts:

- `po` — the full PO object from the detail page query, including all lines with their `orderedQty`, `receivedQty`, `isFullyReceived`, `expectedCostPrice`, `productNameSnapshot`, `variantDescriptionSnapshot`, and `lineId`.
- `open` — boolean controlling Dialog visibility.
- `onOpenChange(open: boolean)` — from the parent.
- `tenantSlug` — needed for TanStack Query invalidation.
- `onSuccess(result: ReceiveResult)` — called with the API response after a successful submission.

Local state: a `receivingEntries` map (using `useState<Record<string, { thisQty: number; actualCostPrice: string }>>`) keyed by `lineId`. Initialise this map when the component mounts or when `po.lines` changes using a `useEffect`, setting `thisQty: 0` and `actualCostPrice: line.expectedCostPrice.toString()` for every line where `isFullyReceived` is false.

### Step 2: Filter Lines to Show

Compute `displayableLines` by filtering `po.lines` to only those where `isFullyReceived` is false. If `displayableLines` is empty, the modal body should render a message "All lines for this purchase order have been fully received." with only a "Close" button. This edge case can occur if the modal is somehow opened on a PO where all lines were completed in a previous receiving session before the status was advanced.

### Step 3: Render the Lines Table

Inside ShadCN `Dialog` + `DialogContent`, render:

- `DialogHeader` with `DialogTitle` "Receive Goods" and `DialogDescription` showing the PO short reference and supplier name.
- A scrollable table (max height constrained so the footer remains visible on screen) with the following columns:

| Column | Width | Notes |
|---|---|---|
| Product | Flex grow | `productNameSnapshot` bold, `variantDescriptionSnapshot` muted below it |
| Ordered | Fixed | `orderedQty`, grey read-only |
| Prev. Received | Fixed | `receivedQty`, green if > 0 |
| Remaining | Fixed | `orderedQty - receivedQty`, amber |
| This Receiving | Fixed | Stepper input, min 0, max = remaining, bound to `receivingEntries[lineId].thisQty` |
| Actual Cost (Rs.) | Fixed | Decimal Input, pre-filled from `expectedCostPrice`, bound to `receivingEntries[lineId].actualCostPrice` |

Stepper implementation: render the input with a `−` button on the left and a `+` button on the right. The `−` button is disabled when `thisQty === 0`. The `+` button is disabled when `thisQty === remaining`. Both buttons adjust the value by 1. The input itself also accepts direct keyboard entry.

### Step 4: Render the Session Summary Footer

Below the table, render a `DialogFooter` section. Before the action buttons, add a summary line: if total items being received (sum of all `thisQty > 0` entries) is greater than zero, show "Receiving [total] item(s) across [N] line(s) this session." in a small muted badge. If total items is zero, show "Enter quantities to receive."

The "Confirm Receipt" button: primary style, disabled when total items is zero or when any entry violates the over-receive constraint. When enabled, show the total item count in the button label for quick confirmation: "Confirm Receipt (N items)".

### Step 5: Validate Before Submit

Before calling the API, run a client-side validation pass over `receivingEntries`:

- For each entry with `thisQty > 0`, confirm `thisQty <= (line.orderedQty - line.receivedQty)`. If any line fails this check, set an `errors` state record and render an inline error below the offending table row: "Cannot receive more than N remaining." Do not proceed to the API call.
- Confirm `actualCostPrice` for each entry with `thisQty > 0` parses to a non-negative number. If it fails (e.g., user typed an invalid string), mark that field with an error.

### Step 6: Submit and Handle Response

Use a TanStack Query mutation to POST to `/api/purchase-orders/[po.id]/receive`. The request body is constructed by filtering `receivingEntries` to entries where `thisQty > 0` and mapping each to `{ lineId, receivedQty: entry.thisQty, actualCostPrice: parseFloat(entry.actualCostPrice) || undefined }` — omit `actualCostPrice` if the value equals the `expectedCostPrice` unchanged (optional optimisation; always including it is also acceptable).

On success: show a ShadCN toast "Goods received successfully." Close the modal. Invalidate `['purchase-order', tenantSlug, po.id]` via `queryClient.invalidateQueries`. Call `onSuccess(result)`.

On error: show a toast with the error message from the API response and keep the modal open.

### Step 7: Implement the Cost Price AlertDialog in the Parent

In the PO Detail page (`[poId]/page.tsx`), add local state `costPriceChanges: CostPriceChange[] | null`. In the `onSuccess` callback passed to `GoodsReceivingModal`, set `costPriceChanges` to `result.costPricesChanged` if the array length is greater than zero, otherwise to null.

Render a second ShadCN `AlertDialog` controlled by `costPriceChanges !== null`. Its content:

- Title: "Cost Prices Updated"
- Description paragraph: "The following variant cost prices were updated during this receiving session to reflect the actual invoiced cost:"
- A bulleted list of each change in the format: "[variantDescriptionSnapshot]: Rs. [oldCostPrice] → Rs. [newCostPrice]"
- Note: "These changes affect margin calculations in your sales and reports."
- Single action button: "Understood" — sets `costPriceChanges` to null and closes the dialog.

There is no "Undo" option because the database transaction has already committed.

---

## Expected Output

- `src/components/suppliers/GoodsReceivingModal.tsx` — full Dialog component with table, steppers, validation, and submission.
- `src/app/dashboard/[tenantSlug]/suppliers/purchase-orders/[poId]/page.tsx` — updated to render the modal and handle the cost-price AlertDialog.

---

## Validation

- [ ] The modal renders only non-fully-received lines.
- [ ] The "Confirm Receipt" button is disabled when all `thisQty` inputs are 0.
- [ ] Setting a `thisQty` beyond the remaining quantity shows an inline error and blocks submission.
- [ ] A successful receipt closes the modal and the PO detail page immediately shows updated `receivedQty` values.
- [ ] When `costPricesChanged` is non-empty, the AlertDialog appears after the modal closes.
- [ ] The AlertDialog lists old and new cost price for each changed variant in a readable format.
- [ ] The "Understood" button closes the AlertDialog without any further side effects.

---

## Notes

- The `actualCostPrice` input should treat an empty or blank entry as "same as expected" — do not send `actualCostPrice: NaN` to the API if the user clears the field. Default to the `expectedCostPrice` value in that case.
- The scrollable table is important on screens with many PO lines. Cap the modal height at around 70 vh and let the table scroll internally so the footer with the submit button is always visible.
- Consider adding a keyboard shortcut hint in the footer: "Press Enter to confirm" when the button is enabled, to speed up the workflow for staff who prefer keyboard navigation.
