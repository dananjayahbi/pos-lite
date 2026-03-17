# Task 03.02.04 — Build Card Payment Modal

## Metadata

| Field | Value |
|---|---|
| Task | 03.02.04 |
| Name | Build Card Payment Modal |
| Sub-Phase | 03.02 — Payments, Receipts & Offline Mode |
| Complexity | Medium |
| Depends On | Task_03_02_03 |
| Produces | src/components/pos/CardPaymentModal.tsx |

## Objective

Build the CardPaymentModal component presented to the cashier when they select CARD as the payment method. The modal confirms the total, informs the cashier to process the payment on the physical card machine first, captures an optional terminal approval code for audit purposes, and submits the sale to the API on confirmation.

## Instructions

### Step 1: Create the Component File

Create src/components/pos/CardPaymentModal.tsx. Use the same props interface pattern established in CashPaymentModal: open (boolean), onClose (void callback), onSaleComplete (callback accepting CompletedSale), totalAmount (Decimal), and salePayload (CreateSalePayload). Import the same shared types. Follow the established module structure — imports first, then the interface, then the component, then the export.

### Step 2: Dialog Shell and Header

Implement the dialog frame using ShadCN Dialog, DialogContent, DialogHeader, and DialogTitle. Set max-w-sm on DialogContent, matching the cash modal dimensions for visual consistency across all payment modals. The DialogTitle reads "Card Payment" in Playfair Display using the heading font class. As with the cash modal, suppress backdrop and Escape dismissal while an API submission is in progress by intercepting the onInteractOutside and onEscapeKeyDown events.

The overall layout of the card modal is intentionally simpler than the cash modal — there is no variable amount entry and no change calculation because the card total is always the full sale amount. The visual flow from top to bottom is: total amount display, informational guidance banner, terminal reference input, Phase 5 integration slot, and the submit button.

### Step 3: Total Due Display

Render the total due section identically to CashPaymentModal: a small "Total Due" label in mist colour followed by the formatted total amount in JetBrains Mono, text-3xl, bold, espresso colour. This consistent presentation across all three payment modals means cashiers can locate the total at a glance regardless of which modal is displayed.

The total amount is read-only in this modal — it is a Decimal prop, not an editable input.

### Step 4: Informational Guidance Banner

Immediately below the total display, render a permanent informational banner. The banner uses a linen-background rounded container with a left border in the info semantic colour (#1D4E89). Inside, render the text: "Please process the payment on your card machine before confirming here. This system does not connect to the card terminal directly." The text is rendered in a small font size in the foreground/body colour. The banner cannot be dismissed — it is always visible in the card modal. Its purpose is to prevent cashiers from accidentally confirming a card payment before it has been processed on the physical terminal.

### Step 5: Terminal Reference Input

Below the informational banner, render the terminal reference input section. The section label reads "Terminal Reference / Approval Code". Use a standard ShadCN Input component. The placeholder text inside the input is "e.g. 481200". The input accepts free-form text with a maximum length attribute of 20 characters.

Place a small info icon (Lucide Info) directly beside the label text. Wrap the icon in a ShadCN Tooltip component so that hovering or focusing the icon shows the tooltip text: "Enter the approval code from the card terminal receipt for your records. This helps reconcile transactions if a dispute arises. The field is optional." The tooltip trigger must be a focusable element for keyboard accessibility — use a button element with aria-label or rely on the ShadCN Tooltip's default trigger setup.

Store the input value in a cardReferenceNumber state variable of type string, initialised to an empty string. This field is optional and the submit button must never be disabled solely because this field is empty.

### Step 6: Phase 5 Integration Slot

Below the terminal reference input, add an empty div element. Set a data attribute on it: data-payhere-integration-slot with the value "true". Add a developer-facing JavaScript comment immediately above this div explaining that this slot is the designated insertion point for the PayHere hosted payment integration to be built in Phase 05. In Phase 05, the terminal reference input will be conditionally hidden when PayHere is active, and this slot will contain the PayHere redirect action button and any associated status indicators.

This div renders nothing visible for the current phase. Its presence ensures the layout does not require structural changes to the component when Phase 05 integration work begins.

### Step 7: Submit Button

Place the submit button in the DialogFooter area. The button label reads "Card Payment Confirmed — Rs. [total formatted]". Apply the espresso background and pearl text styling consistent with CashPaymentModal. The button is disabled only when an API submission is in progress — it is never disabled because the reference field is empty.

When the submission is in progress, replace the label text with a Lucide Loader2 spinning icon. Below the submit button, render a plain text "Cancel" link that calls onClose. The cancel link remains clickable even while the submission is in progress — if the cashier clicks cancel mid-submission, display a confirmation prompt: "Are you sure? The sale may still be processing." If confirmed, set a cancelled flag and suppress the onSaleComplete callback if the response arrives after cancellation.

### Step 8: API Submission

When the submit button is clicked, construct the final sale payload by spreading the salePayload prop and adding paymentMethod set to "CARD" and cardReferenceNumber set to the current state value (which may be an empty string — the API schema treats it as optional and accepts empty strings, interpreting them as no reference provided). Call POST /api/sales. On success, invoke onSaleComplete with the returned sale. On error, show an error toast and re-enable the submit button. Do not close or reset the modal on error.

## Expected Output

- src/components/pos/CardPaymentModal.tsx created and integrated into the POS terminal payment flow.
- The Phase 5 integration slot div is present in the rendered DOM and visible in browser devtools.

## Validation

- Select CARD in the POS terminal and open the modal — confirm the correct total is displayed and the info banner is visible.
- Leave the reference field empty and confirm the submit button remains enabled.
- Enter a reference code and submit — confirm POST /api/sales receives the cardReferenceNumber field with the entered value.
- Submit without entering a reference — confirm POST /api/sales receives an empty string for cardReferenceNumber.
- Hover or focus the info icon beside the label — confirm the tooltip text is visible.
- In browser devtools, inspect the DOM and confirm the data-payhere-integration-slot div is present.

## Notes

- The tooltip on the reference input label must be keyboard-accessible. ShadCN's Tooltip component wraps a triggering element — ensure it is a focusable button or anchor so keyboard-only users can access the tooltip text.
- The approval code from a physical card terminal is typically 6 digits but can be alphanumeric depending on the terminal vendor. The max 20-character limit and free-form text type accommodates all common formats in Sri Lanka without imposing a regex validation that might frustrate cashiers.
- In Phase 05, when a PayHere gateway transaction ID is available, a paymentGatewayTransactionId field will be added to the Payment model and this payload field will be populated automatically. The cardReferenceNumber field will be hidden (not removed) when PayHere is active.
- The modal's state (cardReferenceNumber) resets to an empty string each time the dialog closes, consistent with CashPaymentModal's state reset behaviour.
