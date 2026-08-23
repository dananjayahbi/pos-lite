# 31 — LankaQR Payment

**Module:** M10 — POS & Payments
**Severity:** Medium
**Status:** Not implemented
**Related docs:** 32-mandatory-customer-pos.md

## Issue / Current State
The payment system supports only cash and card. The `PaymentMethod` enum contains CASH, CARD, and SPLIT, and the `PaymentLegMethod` enum contains CASH and CARD only. The POS payment UI — `erp/src/components/pos/CartPanel.tsx`, `CardPaymentModal.tsx`, `CashPaymentModal.tsx`, and `SplitPaymentModal.tsx` — offers Cash, Card, and Split, with no option for LankaQR or any QR-based payment.

The sale service (`erp/src/lib/services/sale.service.ts`) handles payment legs only for cash and card, and the shift/Z-report breakdown does not account for LankaQR.

## Impact
Customers who prefer QR-based mobile payments (LankaQR) cannot pay that way, reducing payment convenience and potentially losing sales. The absence of the method also means Z-reports and shift reconciliation cannot separate QR volumes from cash/card, giving an incomplete payment picture.

## Implementation Plan
### Step 1 — Enums
Add a LANKAQR (and a generic QR if desired) option to the `PaymentMethod` and `PaymentLegMethod` enums in `erp/prisma/schema.prisma`. Add a Prisma migration and update generated types.

### Step 2 — POS payment selector
Extend the POS payment UI in `erp/src/components/pos/CartPanel.tsx` and the payment modals to offer LankaQR as a selectable method, including support in the split-payment modal.

### Step 3 — Sale service handling
Update `erp/src/lib/services/sale.service.ts` to create and record LankaQR payment legs correctly, including validation of payment totals per leg.

### Step 4 — Shift / Z-report breakdown
Extend the shift service (`erp/src/lib/services/shift.service.ts`) and Z-report/reconciliation breakdown to report LankaQR amounts as a distinct line alongside cash and card.

## Dependencies
- 32 interacts with the same POS checkout flow and should be coordinated so the mandatory-customer gate and payment method selection coexist cleanly.

## Files / Areas affected
- `erp/prisma/schema.prisma` — `PaymentMethod` / `PaymentLegMethod` enums.
- `erp/src/components/pos/CartPanel.tsx`, `CardPaymentModal.tsx`, `SplitPaymentModal.tsx`.
- `erp/src/lib/services/sale.service.ts` and `shift.service.ts`.
- `erp/prisma/migrations/` — new migration.
