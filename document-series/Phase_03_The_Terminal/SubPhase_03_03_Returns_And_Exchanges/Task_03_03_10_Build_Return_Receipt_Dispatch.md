# Task 03.03.10 — Build Return Receipt Dispatch

## Metadata

| Field          | Value                                                                                       |
| -------------- | ------------------------------------------------------------------------------------------- |
| Task ID        | 03.03.10                                                                                    |
| Name           | Build Return Receipt Dispatch                                                               |
| SubPhase       | 03.03 — Returns and Exchanges                                                               |
| Status         | Not Started                                                                                 |
| Complexity     | MEDIUM                                                                                      |
| Dependencies   | Task_03_03_07 complete (GET /api/returns/[id] route)                                        |
| Output Files   | src/components/pos/ReturnReceiptDialog.tsx, src/app/api/returns/[id]/receipt/route.ts, src/lib/templates/returnReceipt.ts |

---

## Objective

Build a return receipt system that mirrors the sale receipt system from SubPhase_03_02. After a return is completed, the cashier is presented with a dialog offering WhatsApp dispatch and thermal printing. The receipt template applies the same 80mm thermal paper layout as the sale receipt but adapted for returns.

---

## Context

The return receipt serves as proof of refund for the customer and an operational record for the business. It should be visually similar to the sale receipt so customers recognize it, but clearly labelled as "RETURN RECEIPT" to avoid confusion. The receipt includes the original sale reference so the customer can track the transaction lineage.

WhatsApp dispatch is fire-and-forget, matching the same pattern built in Task_03_02_07. If the customer does not have a WhatsApp number on file (Phase 04 will add customer profiles), the cashier can type the phone number manually.

---

## Instructions

### Step 1: Build the Return Receipt Template

Create `src/lib/templates/returnReceipt.ts` — a function that accepts a `Return` object (with all `ReturnLine` records, `originalSale`, and user references included) and returns an HTML string. This function mirrors `src/lib/templates/saleReceipt.ts` from SubPhase_03_02.

The 80mm receipt contains the following sections in order:

1. Store header — store name (tenant name), store address, contact number. Centered text.
2. Separator line — a row of dashes.
3. "RETURN RECEIPT" label — centered, bold, uppercase.
4. Original Sale reference — "Original Sale: [saleRef]" aligned left.
5. Return reference — "Return Ref: [returnRef]" aligned left.
6. Date and time — "Date: DD/MM/YYYY HH:mm" aligned left.
7. Cashier and Manager lines — "Cashier: [name]" and "Authorized By: [managerName]".
8. Separator line.
9. Items returned section — a left-aligned list. For each ReturnLine: product name on the first row, variant description on the second row indented, then "Qty: X @ Rs. X.XX = Rs. X.XX" on the third row. Use monospace spacing to align the equals-sign column.
10. Separator line.
11. Refund total — "TOTAL REFUND: Rs. X,XXX.XX" — right-aligned, bold.
12. Refund method — "Refund Method: Cash / Card Reversal / Store Credit / Exchange".
13. If refund method is CARD_REVERSAL: "Reversal Ref: [reference]" on the next line.
14. If refund method is STORE_CREDIT: "Credit Note Issued — Redeemable in future purchase."
15. Separator line.
16. Restocked status — "Inventory: Items returned to stock" or "Inventory: Items not restocked."
17. Footer — store's standard thank-you message and "Thank you for shopping at [tenant name]."

The template must include `<style>` with `@page { width: 80mm; margin: 4mm; }` and `@media print { body { font-size: 10pt; font-family: 'Courier New', monospace; } }` so thermal printer rendering is consistent.

### Step 2: Build GET /api/returns/[id]/receipt

Add a GET route handler under `src/app/api/returns/[id]/route.ts` — or create a separate `src/app/api/returns/[id]/receipt/route.ts`.

The handler:
1. Verifies the session and tenant.
2. Fetches the Return with all includes (lines, original sale, initiatedBy, authorizedBy, tenant name and address).
3. Calls `returnReceipt(returnRecord)` to generate the HTML string.
4. Returns the HTML with Content-Type `text/html` and a `Cache-Control: no-store` header (receipts must never be cached).

### Step 3: Build ReturnReceiptDialog

Create `src/components/pos/ReturnReceiptDialog.tsx`. This component is shown after a successful `POST /api/returns` call (when `refundMethod` is not EXCHANGE).

Props:
- `returnId: string`
- `open: boolean`
- `onOpenChange: (open: boolean) => void`
- `onDone: () => void` — called when the cashier is finished and wants to return to the POS terminal

Content:
- Header: a success icon (checkmark in a green circle) and "Return Processed" heading.
- Summary: refund method badge, refund amount in JetBrains Mono large font (Rs. X,XXX.XX), return reference in muted text.
- WhatsApp Dispatch section: a phone number input pre-labelled with Sri Lanka country code (+94). A ShadCN `Button` "Send via WhatsApp" calls a handler that POSTs to the WhatsApp send endpoint (same as the sale receipt WhatsApp dispatch — `POST /api/whatsapp/send-receipt`) with `type: "return"` and `returnId`. On success, show a green "Sent" confirmation next to the button. On failure, show an inline error.
- Print section: a "Print Return Receipt" button that opens `GET /api/returns/[id]/receipt` in a new tab and calls `window.print()` after the tab has loaded. Alternatively, open an iframe and trigger print — use the same approach as the sale receipt printer in Task_03_02_08.
- Footer buttons: a "Done — Return to Terminal" button (primary) that calls `onDone()`, and a smaller "Skip Receipt" link-style button that also calls `onDone()`.

### Step 4: Trigger the Dialog After Return Completion

In `ReturnWizardSheet.tsx`, after a successful `POST /api/returns` where `refundMethod !== EXCHANGE`:
1. Store the returned `returnId` in component state.
2. Set a `showReceipt: true` flag.
3. Render `ReturnReceiptDialog` with `open={showReceipt}` and `returnId`.
4. Wire `onDone` to close both the receipt dialog and the ReturnWizardSheet, then call the parent's `onReturnComplete()` callback to refreshe the Sale History query.

---

## Expected Output

- `returnReceipt.ts` generates a correct 80mm HTML receipt for any Return record
- `GET /api/returns/[id]/receipt` returns the HTML receipt for printing
- `ReturnReceiptDialog` shows after every non-exchange return completion
- WhatsApp dispatch works and shows confirmation
- "Print Return Receipt" in the Return History detail modal also works (uses the same endpoint)

---

## Validation

- The printed receipt clearly shows "RETURN RECEIPT" at the top
- Card reversal receipts include the reversal reference number
- Store credit receipts include the "Credit Note Issued" notice
- The WhatsApp button sends to the entered phone number and shows "Sent" on success
- Closing the dialog resets the ReturnWizardSheet and refreshes the Sale History table

---

## Notes

The WhatsApp send handler must format the return receipt as a text-based message for WhatsApp (since Meta Cloud API sends text messages or document messages, not raw HTML). Create a `formatReturnReceiptForWhatsApp(returnRecord)` function in `src/lib/whatsapp.ts` that generates a plain text version of the receipt using line breaks and Unicode dashes for separators. This plain text version is sent as a WhatsApp message; the thermal HTML is only for direct printing.
