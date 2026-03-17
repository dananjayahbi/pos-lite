# Task 03.03.04 — Build Return Item Selection Panel

## Metadata

| Field          | Value                                                  |
| -------------- | ------------------------------------------------------ |
| Task ID        | 03.03.04                                               |
| Name           | Build Return Item Selection Panel                      |
| SubPhase       | 03.03 — Returns and Exchanges                          |
| Status         | Not Started                                            |
| Complexity     | MEDIUM                                                 |
| Dependencies   | Task_03_03_03 complete (ReturnWizardSheet shell)        |
| Output Files   | src/components/pos/ReturnItemSelectionStep.tsx          |

---

## Objective

Build the first step of the ReturnWizardSheet: a line-item table showing everything in the original sale, with per-line quantity steppers so the cashier can specify exactly which items (and how many) the customer is returning.

---

## Context

Partial returns are a first-class feature. A customer may want to keep one item from a two-item sale and return the other. The panel reflects this by showing every line and only enabling steppers for lines that still have returnable quantity remaining. Items that were already fully returned in a prior transaction are shown in a muted state as a historical reference rather than hidden, which helps the cashier understand the full context of the original sale.

---

## Instructions

### Step 1: Create the ReturnItemSelectionStep Component

Create `src/components/pos/ReturnItemSelectionStep.tsx`. Props:
- `sale: Sale & { saleLines: (SaleLine & { returnedAlready: number })[] }` — the sale with per-line returned quantity already computed and included
- `value: { saleLineId: string, variantId: string, quantity: number }[]` — the currently selected return lines (managed by the parent ReturnWizardSheet)
- `restockItems: boolean` — current value of the restock toggle
- `onChange: (lines, restockItems) => void` — callback to lift state into the parent

### Step 2: Build the Line Items Table

Render a table with the following columns:

- Product — product name and variant description (e.g., "Classic Slim Tee — S / Ivory"). Use Inter font for the name, and a muted secondary line for the variant description.
- Unit Price — right-aligned in JetBrains Mono format (Rs. 1,250.00)
- Orig. Qty — original `SaleLine.quantity`
- Returned — quantity already returned in prior transactions. Display "—" if zero.
- Returnable — `SaleLine.quantity - returnedAlready`. If this is zero, show a tertiary muted label "None remaining".
- Return Qty — a stepper input (decrement button, number display, increment button) with min=0 and max=returnable qty. When returnable qty is 0, the entire stepper is disabled and the row is rendered at reduced opacity.

For the stepper, use ShadCN `Button` components with `variant="outline"` for the decrement and increment controls. The number in between shows the current return quantity. Clicking decrement when the value is already 0 does nothing. Clicking increment when the value is already at max does nothing.

### Step 3: Compute and Show the Refund Preview

Below the table, render a summary panel. This panel updates reactively as the cashier changes quantities.

For each line where the selected return quantity is greater than 0, compute the proportional refund: `(returnQty / originalQty) × SaleLine.lineTotal`. Display these as a list of "Product Name ×Qty — Rs. X.XX" rows.

Below the list, show the grand total refund amount with prominent typography: use JetBrains Mono in espresso color, slightly larger font size. Label it "Estimated Refund Total".

Include a small note in muted secondary style beneath the total: "Final refund amount may differ if line discounts were applied."

### Step 4: Add the Restock Toggle

Below the refund preview, add a row containing a ShadCN `Switch` component. The label is "Restock returned items to inventory" (Inter, regular weight). The Switch defaults to the `restockItems` prop value. When toggled, call `onChange` with the current lines and the new `restockItems` value.

Below the switch, conditionally render a helper note when `restockItems` is `false`: "Returned items will not be added back to stock. Use this for damaged or unsellable items." — in muted warning color.

### Step 5: Validate for Next Button

The parent component's "Next" button is enabled when `value.some(l => l.quantity > 0)`. This component does not render the Next button itself — it only manages and emits state. The parent handles navigation.

---

## Expected Output

A `ReturnItemSelectionStep` component that renders a correct, reactive line-item table with per-line quantity steppers, a live refund preview, and a restock toggle.

---

## Validation

- Steppers cannot be incremented past the returnable qty for each line
- Steppers for lines with zero returnable qty are rendered but fully disabled and dimmed
- The refund total updates immediately when a stepper value changes
- The restock toggle off-state shows the warning note
- Lines with zero return qty do not appear in the refund preview rows

---

## Notes

The refund preview computation here is a client-side estimate using `SaleLine.lineTotal / SaleLine.quantity × returnQty`. The definitive proportional calculation (accounting for line-level discount distribution) is performed server-side in `return.service.ts`. The client-side preview is sufficient for UX purposes and will almost always match exactly.
