# Task 03.03.06 — Build Exchange Flow

## Metadata

| Field          | Value                                                  |
| -------------- | ------------------------------------------------------ |
| Task ID        | 03.03.06                                               |
| Name           | Build Exchange Flow                                    |
| SubPhase       | 03.03 — Returns and Exchanges                          |
| Status         | Not Started                                            |
| Complexity     | HIGH                                                   |
| Dependencies   | Task_03_03_05 complete, Task_03_03_07 complete         |
| Output Files   | src/stores/cartStore.ts (modified), src/components/pos/CartPanel.tsx (modified), src/components/pos/payment/CashPaymentModal.tsx (modified), src/components/pos/payment/CardPaymentModal.tsx (modified), src/components/pos/payment/SplitPaymentModal.tsx (modified) |

---

## Objective

Implement the exchange workflow, where a completed Return with `refundMethod: EXCHANGE` pre-populates the POS terminal with an exchange credit that offsets the total of the new cart. The exchange is not a separate model — it is a Return record linked to a new Sale via `Sale.linkedReturnId`.

---

## Context

The exchange flow is the most complex feature in SubPhase_03_03 because it crosses the boundary between the return wizard (a sheet overlay) and the POS terminal's main cart state (Zustand store). After the return is finalized, the sheet closes and the POS terminal must respond to the newly injected exchange data without a full page reload.

The design deliberately keeps exchanges as a Return-first flow: the return is committed first (inventory is restocked, the Return record is COMPLETED), and then the exchange credit is loaded into the cart. This means if a system failure occurs between the two steps, the return is still valid and the credit can be reconstituted manually.

---

## Instructions

### Step 1: Extend the Zustand Cart Store

In `src/stores/cartStore.ts`, add the following fields to the cart state:
- `linkedReturnId: string | null` — the ID of the Return that spawned this exchange cart
- `exchangeCredit: Decimal | null` — the refund value from that Return, to be deducted at payment
- `exchangeReturnRef: string | null` — a short display reference for the exchange (e.g., "RET-00042") to show in the banner

Add corresponding actions:
- `setExchangeCredit(returnId, credit, ref)` — sets all three exchange fields together
- `clearExchangeCredit()` — resets all three fields to null

These fields must also be persisted to IndexedDB via the same persistence effect used for the rest of cart state, so an exchange cart survives a browser refresh.

### Step 2: Trigger Exchange Mode After Return Submission

In the ReturnWizardSheet's submission handler, after a successful `POST /api/returns` response with `refundMethod: EXCHANGE`:

1. Extract `returnId`, `refundAmount`, and the return reference from the response.
2. Call `useCartStore.getState().clearCart()` to discard any existing items.
3. Call `useCartStore.getState().setExchangeCredit(returnId, refundAmount, returnRef)` to inject the exchange data.
4. Close the ReturnWizardSheet.
5. Navigate the user to the POS terminal main route using `router.push(posTerminalRoute)` if not already there.

For all other refund methods (CASH, CARD_REVERSAL, STORE_CREDIT), open the `ReturnReceiptDialog` instead.

### Step 3: Render the Exchange Mode Banner in CartPanel

In `src/components/pos/CartPanel.tsx`, read `linkedReturnId` and `exchangeCredit` from the cart store. When `linkedReturnId` is set, render a green info banner at the top of the cart panel (above the line items). Banner content: "Exchange Mode — Return [returnRef]" on the first line, "Applied Credit: Rs. [exchangeCredit]" on the second line in JetBrains Mono. Use a success-toned background (translucent success color) with an espresso border. Add an "×" dismiss button on the banner — clicking it calls a ShadCN `AlertDialog` asking: "Cancel the exchange? The return has already been processed. The exchange credit cannot be automatically reversed." with two buttons: "Keep Exchange" (closes the dialog) and "Discard Credit" (calls `clearExchangeCredit()` — does not reverse the Return).

### Step 4: Apply Exchange Credit in Payment Totals

Wherever the cart's `totalAmount` is computed and displayed (CartPanel total row, payment modals), update the formula to:

`netPayableAmount = max(0, cartTotal - exchangeCredit)`

Display this as a two-row total in the cart footer:
- Row 1: "Cart Total" in muted style — Rs. [cartTotal] (struck through if exchangeCredit reduces it fully)
- Row 2 (only when exchange credit active): "Exchange Credit" in success color — – Rs. [exchangeCredit]
- Row 3: "Amount Due" in espresso bold — Rs. [netPayableAmount]

### Step 5: Update Payment Modals for Exchange Credit

In each payment modal (CashPaymentModal, CardPaymentModal, SplitPaymentModal), receive `exchangeCredit: Decimal | null` and `netPayableAmount: Decimal` as props or read them from cart store. Display `netPayableAmount` (not `cartTotal`) as the amount the customer owes.

Handle the zero-net case: when `netPayableAmount <= 0`, the payment modals should never open. Instead, in the CartPanel, the charge button changes to "Complete Exchange (No Payment Due)". Clicking it calls `POST /api/sales` directly with `paymentMethod: EXCHANGE`, `linkedReturnId`, and no Payment records.

When `netPayableAmount > 0` and the exchange credit covers part of the total, the payment modal shows:
- "Sale Total: Rs. [cartTotal]"
- "Exchange Credit Applied: – Rs. [exchangeCredit]"
- "Amount to Collect: Rs. [netPayableAmount]" in bold

### Step 6: Persist Exchange Context on Sale Completion

When `POST /api/sales` is called for an exchange cart, include `linkedReturnId` in the request body (alongside the standard sale fields). The sale API route (built in SubPhase_03_02) must be updated to accept this optional field and write it to `Sale.linkedReturnId`. After the sale is completed, call `clearExchangeCredit()` in the cart store.

---

## Expected Output

- Exchange credit fields exist in the Zustand cart store and persist to IndexedDB
- After a EXCHANGE return, the POS terminal shows the exchange banner in CartPanel
- Payment modals deduct the exchange credit from the displayed total
- Zero-net charge exchanges complete without opening a payment modal
- The completed exchange sale has `linkedReturnId` populated in the database

---

## Validation

- Setting an exchange credit of Rs. 1,500 on a cart totaling Rs. 1,200 results in netPayableAmount of Rs. 0 and the "No Payment Due" path is taken
- Setting an exchange credit of Rs. 800 on a cart totaling Rs. 1,500 shows Rs. 700 as the amount due
- Refreshing the browser while in exchange mode restores the exchange banner (IndexedDB persistence)
- The "Discard Credit" path does NOT reverse the Return record in the database

---

## Notes

In Phase 04, the excess exchange credit (when return value exceeds the new cart total) will be automatically converted to a StoreCredit record rather than being silently discarded. In Phase 03, the discarded excess is acceptable but should be surfaced in the Z-Report for the shift as a line: "Exchange Credit Discarded: Rs. [amount]" so managers are aware.
