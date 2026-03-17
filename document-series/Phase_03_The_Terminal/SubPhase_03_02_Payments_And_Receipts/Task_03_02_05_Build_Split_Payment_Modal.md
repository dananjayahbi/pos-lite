# Task 03.02.05 — Build Split Payment Modal

## Metadata

| Field | Value |
|---|---|
| Task | 03.02.05 |
| Name | Build Split Payment Modal |
| Sub-Phase | 03.02 — Payments, Receipts & Offline Mode |
| Complexity | High |
| Depends On | Task_03_02_04 |
| Produces | src/components/pos/SplitPaymentModal.tsx |

## Objective

Build the SplitPaymentModal component for the scenario where a customer pays part of their bill by card and the remainder in cash. The modal guides the cashier through specifying the card portion, auto-computing the cash portion, accepting the physical cash tendered, calculating change for the cash leg, capturing an approval code for the card leg, and validating that all amounts are internally consistent before enabling submission.

## Instructions

### Step 1: Create the Component File

Create src/components/pos/SplitPaymentModal.tsx. Use the same props interface pattern: open (boolean), onClose (void callback), onSaleComplete (callback accepting CompletedSale), totalAmount (Decimal), and salePayload (CreateSalePayload). The dialog uses max-w-md rather than max-w-sm — the split modal has more interactive elements that benefit from the additional horizontal space.

Declare five state variables using React's useState. The cardAmount variable is a Decimal or null, representing the amount the customer will pay by card. The cashReceived variable is a Decimal or null, representing the cash the customer physically hands over. The cardReferenceNumber variable is a string, initially empty. The isSubmitting variable is a boolean tracking API call state. The validationMessage variable is a string or null holding the first failing validation message to display above the submit button.

### Step 2: Dialog Header

Set the DialogTitle to "Split Payment" in Playfair Display. Below the title, add a subtitle paragraph in mist colour at a small font size: "Part card, part cash — both amounts must add up to the total." This subtitle appears only in the header and gives the cashier immediate context before they interact with any input.

### Step 3: Total Due Display

Render the same large JetBrains Mono total amount display at the very top of the dialog body, in espresso colour, following the identical layout from CashPaymentModal and CardPaymentModal. The total is the fixed reference point for all calculations in this modal.

### Step 4: Card Amount Input

Render the "Card Amount" input section below the total. Label it "Amount to charge to card" with an asterisk indicating it is required. Use a ShadCN Input with a "Rs." prefix in the same inlined-prefix style as CashPaymentModal. The input is numeric and accepts positive decimal values.

On each keystroke, parse the raw input string into a Decimal and store it in the cardAmount state. If the entered value exceeds totalAmount (checked via Decimal's .greaterThan method), display an inline validation error directly below the input in danger red (#9B2226): "Card amount cannot exceed the total due." This error appears immediately as the user types — do not wait for them to blur the field.

### Step 5: Cash Amount Display

Immediately below the card amount input, render the computed cash amount as a read-only display field. Compute it dynamically as totalAmount minus cardAmount whenever cardAmount changes, using Decimal's .minus method. Display the result with a "Rs." label in a container that has a visible sand-coloured background (#CBAD8D at low opacity) and a rounded border, visually distinguishing it from editable inputs. Label it "Remaining cash amount (auto-computed)".

When cardAmount is null or invalid, show "—" in this field. When cardAmount equals totalAmount exactly (Decimal's .equals method), show "Rs. 0.00" with a gentle note beneath: "No cash needed — consider using the Card Payment flow instead." When the computed value would be negative (card exceeds total), show the field in danger red to mirror the validation error on the card input.

### Step 6: Allocation Summary Row

Below the two amount fields, render a live allocation summary row. Its text reads: "Card: Rs. [cardAmount]  +  Cash: Rs. [cashAmount]  =  Rs. [sum]". Compute the sum as cardAmount plus cashAmount using Decimal addition. When sum equals totalAmount (Decimal's .equals method), apply success green (#2D6A4F) text to the entire row and add a Lucide CheckCircle2 icon in success green to the left. When the sum does not match, display the row in the mist colour without an icon. This row gives the cashier a continuous reassurance signal that the allocation is correctly configured.

### Step 7: Cash Received Input

Render the cash received section conditionally — only show it when cardAmount is valid (not null) and the auto-computed cashAmount is strictly greater than zero. Use a Tailwind transition-opacity animation for a smooth appearance: the section transitions from opacity-0 to opacity-100 when the condition becomes true.

The cash received input is structurally identical to the one in CashPaymentModal: a large numeric input with a "Rs." prefix and the "Cash Received" label. Below the input, show the live change calculation for the cash leg only — cashReceived minus cashAmount (not cashReceived minus totalAmount). Apply the same conditional success/danger styling as in CashPaymentModal based on whether the entered cash covers the cash portion.

Store the entered value in the cashReceived Decimal state variable.

### Step 8: Terminal Reference Input

Below the cash received section, render the card approval code input. Label it "Card Approval Code" for brevity (shorter than the full label used in CardPaymentModal, because the split modal already has more content). This input is functionally identical to the one in CardPaymentModal — optional free-form text up to 20 characters, same tooltip explanation, same state variable.

### Step 9: Submit Button Validation Logic

Evaluate all four conditions necessary to enable the submit button. Condition one: cardAmount is not null and is greater than zero. Condition two: the computed cashAmount is greater than zero (equivalently, cardAmount is less than totalAmount). Condition three: the sum of cardAmount and cashAmount equals totalAmount using Decimal's .equals method. Condition four: cashReceived is not null and is greater than or equal to cashAmount using Decimal's .greaterThanOrEqualTo method.

Evaluate the conditions in order and capture the first failing condition's message in the validationMessage state. Store this in the state variable declared in Step 1. Render this message directly above the submit button in a small danger-coloured text span. Only the first failing message is shown at any time — do not show a list of all failing conditions simultaneously.

The submit button label reads "Complete Split Payment — Rs. [total formatted]". Apply the espresso and pearl styling. Disable the button when any condition fails or when isSubmitting is true.

### Step 10: API Submission

On submit, construct the final payload from the salePayload prop and add: paymentMethod set to "SPLIT", cardAmount as a JavaScript number converted from the Decimal, cardReferenceNumber as the current string value, and cashReceived as a JavaScript number. The API route interprets these fields to create two Payment records. Call POST /api/sales. On success, call onSaleComplete with the returned sale and include the computed change amount — the parent uses this to display the change in the ReceiptPreviewDialog. On error, show an error toast and reset isSubmitting to false.

## Expected Output

- src/components/pos/SplitPaymentModal.tsx created and correctly handling all validation conditions.
- The cash received section only appears after the card amount is validly entered and the computed cash portion is positive.
- The allocation summary row turns green only when the amounts sum exactly to the total.

## Validation

- Enter a card amount greater than the total — confirm the danger validation error appears on the card input and the submit button is disabled.
- Enter a valid card amount (less than total) — confirm the cash amount auto-computes correctly and the allocation summary turns green.
- Enter a cash received amount below the computed cash portion — confirm the submit button is disabled and the validation message appears above it.
- Enter a cash received amount above the cash portion — confirm the change is shown in success green.
- Submit a valid split payload — confirm POST /api/sales is called and receives paymentMethod "SPLIT", cardAmount, cashReceived, and cardReferenceNumber.
- Confirm the ReceiptPreviewDialog opens with the correct change amount for the cash leg.

## Notes

- All comparisons and arithmetic on Decimal instances must use Decimal methods. The equality check for "does the allocation sum equal the total" must use Decimal's .equals method — using the === operator on two Decimal instances checks reference equality and will always return false.
- The conditional rendering of the cash received section should not cause layout shift. Use CSS height or max-height transitions rather than conditional mounting/unmounting of the DOM nodes, or use a stable placeholder div that transitions into the input.
- The split payment is defined as exactly two legs: one card leg and one cash leg. Multi-way splits (e.g., two cards plus cash) are not supported in VelvetPOS Phase 03. If a customer requests a three-way split, the cashier should split across two transactions — the terminal does not support this natively.
- Reset all state variables (cardAmount, cashReceived, cardReferenceNumber) to their initial values when the dialog closes, for the same reason as the other payment modals.
