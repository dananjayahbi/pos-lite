# POS cash tender: short cash is rejected

The sale API decides how much cash a sale actually requires. It never trusts the
terminal's total or the amount the cashier typed (ARGUS #62).

## Cash due is server-computed

`createSale` recomputes the payable amount from the catalog and tenant settings
before any payment is persisted:

```
totalAmount  = subtotal - cartDiscount + tax + deliveryCharge
payable      = totalAmount - storeCredit - exchangeCredit
cashDue      = CASH  -> payable
               SPLIT -> payable - cardAmount
```

The same `payable` is used to build the payment legs
(`buildSaleTenderLegs`), so the tender the server validates and the tender it
persists can never disagree. A cash portion of zero (card/QR only, credit
covered, zero-value sale) requires no cash.

## Rules

| Tender                     | Result                                                                  |
| -------------------------- | ----------------------------------------------------------------------- |
| `cashReceived < cashDue`   | `400 INSUFFICIENT_CASH` (`cashReceived` field), transaction rolled back |
| `cashReceived == cashDue`  | sale completes, no `changeGiven`                                        |
| `cashReceived > cashDue`   | sale completes, `changeGiven = cashReceived - cashDue`                  |
| missing / malformed tender | treated as zero tendered, so `INSUFFICIENT_CASH`                        |

The check lives in `resolveCashTender` (`saleCashTender.core.ts`) and runs inside
the sale transaction, before it can commit. Because the guard throws, a short
tender leaves no `Sale`, no `Payment` leg, no stock movement and no ledger entry
behind.

`changeGiven` is money: it is rounded to 2dp half-up. Deductions and card legs
keep their own precision, so change is computed only from the cash portion and
never from the full sale total.

## Why this matters

Before the guard, a sale could be completed with any positive cash amount. The
cash leg was still written for the full payable amount, so the drawer and shift
reconciliation showed money that was never collected. The server-side check
means the POS UI is a convenience, not the enforcement: the terminal's
`CashPaymentModal` and `SplitPaymentModal` block a short tender for a better
error message, but a direct API call or an offline/queued sale (which is
replayed through `POST /api/store/sales`) hits the same guard.

## Covered by

- `src/lib/services/__tests__/saleCashTender.core.test.ts` - exact, overpaid and
  short CASH/SPLIT tenders, credit-reduced payables, missing/invalid amounts and
  change rounding.
- `src/lib/services/__tests__/saleTender.core.test.ts` - the persisted legs for
  the same payables.
