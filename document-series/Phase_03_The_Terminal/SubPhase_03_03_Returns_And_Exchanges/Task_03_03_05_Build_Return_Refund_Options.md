# Task 03.03.05 — Build Return Refund Options

## Metadata

| Field          | Value                                                |
| -------------- | ---------------------------------------------------- |
| Task ID        | 03.03.05                                             |
| Name           | Build Return Refund Options                          |
| SubPhase       | 03.03 — Returns and Exchanges                        |
| Status         | Not Started                                          |
| Complexity     | LOW                                                  |
| Dependencies   | Task_03_03_04 complete                               |
| Output Files   | src/components/pos/ReturnRefundOptionsStep.tsx        |

---

## Objective

Build the second step of the ReturnWizardSheet: a refund method selection panel where the cashier chooses how the customer will receive their refund, confirms the refund total, and provides a reason for the return.

---

## Context

The refund options step is intentionally simple — it presents a clear choice between four methods, shows the confirmed refund amount prominently, and captures a reason string for audit purposes. The complexity of exchanges is deferred to Task_03_03_06 and only the exchange option wiring is set up here.

---

## Instructions

### Step 1: Create the ReturnRefundOptionsStep Component

Create `src/components/pos/ReturnRefundOptionsStep.tsx`. Props:
- `refundTotal: Decimal` — total refund amount computed by the parent from the selected lines
- `refundMethod: ReturnRefundMethod` — current selection (managed by parent)
- `cardReversalReference: string` — relevant only when method is CARD_REVERSAL
- `reason: string` — return reason text
- `onChange: (patch: Partial<{ refundMethod, cardReversalReference, reason }>) => void` — callback to update parent state

### Step 2: Display the Refund Total Header

At the top of the step, render a summary card with a light linen background and espresso border. Inside:
- A label "Refund Amount" in small uppercase muted text
- The refund total formatted as "Rs. X,XXX.XX" in JetBrains Mono, espresso color, and a large font size (approximately 2rem)

This persistent display ensures the cashier sees the financial impact before and during method selection.

### Step 3: Render the Refund Method RadioGroup

Use a ShadCN `RadioGroup` with four options. Each option is a card-style radio item showing an icon, a bold label, and a description line. Layout each option as a full-width card row:

- Cash — icon: a banknote or wallet icon. Label: "Cash". Description: "Return money to the customer from the cash drawer immediately."
- Card Reversal — icon: a credit card icon. Label: "Card Reversal". Description: "Process a manual reversal on the card terminal and record the reference number."
- Store Credit — icon: a tag or voucher icon. Label: "Store Credit". Description: "Issue a credit note. The customer can redeem it on a future purchase."
- Exchange Items — icon: a swap/arrows icon. Label: "Exchange Items". Description: "Return these items and apply the refund value toward new items immediately."

When "Card Reversal" is selected, reveal a text input labeled "Reversal Reference Number" immediately below the radio option card. This field accepts up to 50 characters and is required when submitting with CARD_REVERSAL method.

When "Exchange Items" is selected, hide the refund total header card and render an information banner in its place: "The refund value of Rs. [amount] will be applied as credit on the next cart." Use a terracotta accent tone for this banner to visually differentiate exchange mode.

When "Store Credit" is selected, show an information note below the radio group: "A store credit record will be created. The credit can be redeemed at checkout once Phase 04 CRM is complete."

### Step 4: Render the Return Reason Field

Below the radio group, render a `Textarea` component labeled "Return Reason" with a placeholder such as "Customer changed their mind — wrong size". Maximum 200 characters. A character count display below the field (e.g., "48 / 200"). This field is optional — the form does not block progression if it is empty. Call `onChange({ reason })` on each keystroke.

---

## Expected Output

A `ReturnRefundOptionsStep` component that correctly renders all four refund method options, conditionally shows the card reference input and exchange banner, and captures the return reason.

---

## Validation

- Selecting Card Reversal reveals the reference number input
- Selecting Exchange hides the refund total header and shows the exchange credit banner with the correct amount
- The refund total is displayed accurately using JetBrains Mono formatting
- The reason textarea enforces the 200-character limit and shows a live character count
- Selecting each method updates the parent state via onChange

---

## Notes

The component defaults to `refundMethod: CASH` when first rendered (this default is set in the ReturnWizardSheet parent). The component receives the current selection via props and is fully controlled. It has no internal refund method state.
