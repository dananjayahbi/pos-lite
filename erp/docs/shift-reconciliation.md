# Shift cash reconciliation uses payment legs

Cash, card and QR totals for a shift are derived from the sale's **payment
legs**, not from `Sale.paymentMethod` (ARGUS #106). A SPLIT sale has one cash
leg and one digital leg; reading the single `SPLIT` method skipped both and hid
the cash shortage (stored closure reported +Rs. 0.06 while the Z-report, which
already summed legs, reported −Rs. 835.31).

## Single source of truth

- `sumPaymentBreakdown()` (`src/lib/services/paymentBreakdown.ts`) sums the
  `Payment` rows into cash/card/QR. STORE_CREDIT and EXCHANGE_CREDIT legs are
  excluded (no money moved).
- `computeExpectedCash()`, `sumShiftRefunds()` and `sumShiftCashMovements()`
  (`src/lib/services/shiftCash.core.ts`) own the drawer arithmetic.

`closeShift`, `getShiftById` and `buildZReportData` all call these helpers, so
the stored closure, the shift-detail API and the Z-report cannot disagree.

```
expectedCash = openingFloat
             + Σ cash payment legs
             − Σ cash refunds
             + manual cash deposits
             − petty cash out
```

A cash sale contributes its cash leg; a SPLIT sale contributes exactly its cash
portion; credit tenders contribute nothing.

## What the closure stores

`ShiftClosure.totalCashAmount`, `totalCardAmount` and `totalQrAmount` are the
payment-leg totals (including SPLIT legs), and `expectedCash`/`cashDifference`
use the shared formula. The shift-closed notification reads the same
`cashDifference`, so it now alerts on the real shortage.

## One authoritative figure on the shift detail page

The shift detail page (`/staff/shifts/[id]`) now takes **expected cash, actual
cash counted and the cash difference from the same Z-report payload**, so the
top card, the cash-reconciliation card and the summary can no longer contradict
each other.

A closure recorded before this fix may still hold stale totals in
`ShiftClosure`. The shifts list labels that column **Recorded difference** to
make clear it is the historical snapshot, while the detail page shows the
payment-leg recomputation as the authoritative figure (ARGUS #107).

## Verification

`src/lib/services/__tests__/shiftCash.core.test.ts` covers split cash legs,
refund separation, cash movements, the close/Z-report identity and rounding;
`paymentBreakdown.test.ts` covers the leg summation itself.
