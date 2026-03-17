# Task 03.02.03 — Build Cash Payment Modal

## Metadata

| Field | Value |
|---|---|
| Task | 03.02.03 |
| Name | Build Cash Payment Modal |
| Sub-Phase | 03.02 — Payments, Receipts & Offline Mode |
| Complexity | Medium |
| Depends On | SubPhase_03_01 complete |
| Produces | src/components/pos/CashPaymentModal.tsx |

## Objective

Build the CashPaymentModal component that is presented to the cashier when they select CASH as the payment method and interact with the "Charge / Pay" button in the CartPanel. The modal handles cash amount entry, live change calculation using decimal precision, quick banknote selection, and submission of the completed sale payload to the POST /api/sales endpoint.

## Instructions

### Step 1: Create the Component File

Create the file src/components/pos/CashPaymentModal.tsx. Define a clear TypeScript props interface for the component. The props are: open (boolean controlling dialog visibility), onClose (a void callback invoked when the cashier explicitly dismisses the dialog without completing a sale), onSaleComplete (a callback that accepts the CompletedSale object returned by the API, invoked on successful sale creation), totalAmount (a Decimal representing the cart total), and salePayload (a typed object representing the full assembled sale request body ready to be sent to the API, minus the payment-specific fields that this modal contributes). Import the CompletedSale and CreateSalePayload types from the project's shared types.

### Step 2: Build the Dialog Shell

Use ShadCN's Dialog, DialogContent, DialogHeader, and DialogTitle components. Set the DialogContent to max-w-sm. The DialogTitle reads "Cash Payment" and must be rendered in the Playfair Display typeface using the heading font Tailwind class defined in the design token configuration. Do not allow the dialog to be dismissed by pressing Escape or clicking the backdrop once an API submission is in progress — use the onInteractOutside and onEscapeKeyDown props on DialogContent to intercept and suppress these events while a submission is pending. When not submitting, Escape and backdrop clicks should invoke onClose normally.

### Step 3: Total Due Row

Inside the dialog body, render the "Total Due" row as the first visible content element. The label "Total Due" is displayed in a small uppercase tracking-wide style using the mist colour token (--color-mist). Immediately below the label, render the formatted total amount — for example "Rs. 3,750.00" — using the project's currency formatting utility. Apply the JetBrains Mono font class, a large font size (text-3xl or equivalent), bold weight, and the espresso colour token (--color-espresso). This large total display is the visual anchor of the modal.

### Step 4: Cash Received Input

Below the total due row, render the cash received input section. Label it "Cash Received" in the same muted mist small-label style. The input itself is a standard ShadCN Input component styled for large font entry. Present a non-editable "Rs." prefix visually inlined at the left edge of the input field — implement this as a flex row containing a span with the "Rs." text and the input side by side, with a shared border and background to make them appear as one element.

The input accepts decimal numeric values. Apply the autoFocus prop to ensure the input is focused immediately when the dialog opens, allowing the cashier to type without clicking. If autoFocus alone does not work reliably with the ShadCN Dialog animation, use a useEffect that calls ref.current.focus() with a short setTimeout when the open prop transitions to true.

Maintain the entered value in a cashReceived Decimal state variable. Parse the raw string from the input into a Decimal on each onChange event. If the string is not a valid number, set the state to null or undefined and treat it as empty.

### Step 5: Quick-Amount Buttons

Below the cash input, render a horizontal row of quick-amount preset buttons. The four buttons display Rs. 500, Rs. 1,000, Rs. 2,000, and Rs. 5,000. Clicking a button sets cashReceived to that denomination value. Apply the sand colour scheme to these buttons as small outline variant buttons. A button should appear visually dimmed if its denomination is less than the total due and therefore could not cover the payment on its own — this is a UX hint that reduces cashier errors, not hard validation. The Rs. 5,000 button should always appear active.

### Step 6: Change Calculation Display

Below the quick-amount row, render the change row. The label reads "Change" in the muted small style. The computed value is cashReceived minus totalAmount, calculated using the computeChange utility from payment.service (import it from there). Use a try-catch: if computeChange throws because cashReceived is insufficient, catch the error and treat the state as "insufficient" rather than propagating the exception to the UI.

Apply conditional styling based on the computed state. When change is zero or positive, display the amount in JetBrains Mono with a large font and the semantic success green colour (#2D6A4F). When cashReceived is empty or unparseable, show "—" in mist colour. When cashReceived is below totalAmount (the caught exception case), display the entered amount in the semantic danger red (#9B2226) and render a short warning message below the change row: "Amount entered is insufficient — please enter a higher amount or select a denomination above." This contextual message is only visible during the insufficient state.

### Step 7: Submit Button

In the dialog footer area, place the primary submit button. Its label is "Complete Sale — Rs. [total formatted]". Apply the espresso background colour and pearl text colour. Disable the button when any of these conditions are true: cashReceived is null or undefined (no amount entered), cashReceived is less than totalAmount (insufficient funds), or the API call is currently in progress. When in progress, display a loading spinner (use the Lucide Loader2 icon with a spin animation class) inside the button in place of the label text. Below the submit button, render a plain text "Cancel" link that invokes onClose.

### Step 8: API Submission

When the cashier clicks the submit button and it is enabled, merge the incoming salePayload prop with the payment-specific fields: set paymentMethod to "CASH" and cashReceived to the current numeric value of the cashReceived Decimal (convert to a JavaScript number for the JSON body). Call POST /api/sales using the project's established API request utility. Mark the submission as in-progress using a local isSubmitting boolean state.

On a successful API response, extract the returned sale object and invoke onSaleComplete with it. The parent component is responsible for closing this modal and opening the ReceiptPreviewDialog — this modal should not manage the ReceiptPreviewDialog's state. On an API error, display an error toast using the project's toast utility, set isSubmitting to false to re-enable the submit button, and leave the dialog open so the cashier can retry. Do not clear any entered values on error.

## Expected Output

- src/components/pos/CashPaymentModal.tsx created and integrated into the POS terminal's payment flow.
- The modal renders the correct total, accepts cash amount entry, shows live change, and calls the sale API on confirmation.

## Validation

- Open the POS terminal with items in the cart, select CASH, and trigger the modal — confirm it opens with the correct total displayed.
- Click a quick-amount button — confirm the cash input is pre-filled with the denomination value.
- Enter an amount below the total — confirm the danger styling appears on the change row and the submit button is disabled.
- Enter an amount above the total — confirm the correct change is computed and shown in success green, and the submit button is enabled.
- Submit the modal — confirm POST /api/sales is called and the ReceiptPreviewDialog opens on success.
- Simulate an API error — confirm the error toast is shown and the dialog remains open for retry.

## Notes

- All currency arithmetic must use Decimal from decimal.js — never JavaScript native number subtraction or comparison for monetary values. Floating-point arithmetic on prices compounds errors in ways that are visible to users (e.g., Rs. 0.00000001 of spurious change).
- The quick-amount denominations (500, 1000, 2000, 5000) represent the most commonly used banknotes in Sri Lankan retail transactions. The lower denominations (20, 50, 100) are not shown to keep the button row compact.
- The modal does not retain its state across open/close cycles. When the dialog is closed for any reason, reset cashReceived to null so the input is blank the next time it opens.
