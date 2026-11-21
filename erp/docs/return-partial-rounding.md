# Partial-return rounding (ARGUS #104)

Each partial return recomputed `returnQty / originalQty × line total`, so three
separate 1-of-3 returns on a Rs. 100 line refunded `33.33 + 33.33 + 33.33 =
99.99` and left a one-paisa residual forever.

## Rule

`computeReturnRefund` accepts the line's already-returned state:

| Field | Meaning |
| --- | --- |
| `returnedQuantity` | units already returned on completed returns |
| `returnedRefundAmount` | goods + tax already refunded for the line |
| `returnedTaxAmount` | tax already refunded for the line |

It now refunds a share of the **remaining** balance:

```
remainingRefund = lineTotal - alreadyRefunded
remainingTax    = lineTax  - taxAlreadyRefunded
```

A return that takes the last unit refunds `remainingRefund` exactly, so the
residual lands on the final return. The example now refunds `33.33 + 33.34 +
33.33 = 100.00`.

Legacy callers that only know `returnedQuantity` get a pro-rata estimate of the
prior amounts; callers with no prior data behave exactly as before.

## Wiring

- `Return` service aggregates completed `ReturnLine` quantities and refund/tax
  amounts per sale line inside the return transaction and passes them in.
- `getSaleById` exposes the same sums on each line, so both the management
  sheet and the POS wizard preview the remaining balance rather than the
  original line total.

## Verification

`src/lib/services/__tests__/returnRefund.core.test.ts` includes the 3 × 1-of-3
regression, the final-return remainder and an over-quantity request guard.
