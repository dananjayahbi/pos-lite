# Shift cash movements in the cash flow report (ARGUS #420)

The Cash Movement Summary showed Opening Float Rs 200, Petty Cash Out Rs 35 and
Net Movement Rs 165, while the report's Net Cash Flow stayed at Rs 126,169.43.
The 35 outflow was not in expenses and nothing bridged the shift section to the
ledger, so the two panels looked contradictory.

## Rule

Shift cash movements are recorded on `CashMovement` and are not posted to
payment-account entries. `summarizeShiftCashMovements` in
`src/lib/services/cashflow.core.ts` classifies them:

- `OPENING_FLOAT` - cash moved into the drawer from the safe, a **transfer**
  (not income);
- `MANUAL_IN` / `MANUAL_OUT` - other shift cash in/out;
- `PETTY_CASH_OUT` - an outflow.

```
recordedNet  = opening float + manual in - petty cash out - manual out
operatingNet = manual in - petty cash out - manual out
```

The opening float is shown but excluded from `operatingNet` because it does not
change total business cash; it only moves cash between the safe and the drawer.

## UI

The Cash Reconciliation card now includes a **Shift cash not posted to payment
accounts** block:

- ledger net cash flow;
- shift operating movement (excludes opening float);
- net movement including shift cash;
- opening float marked as a transfer.

The summary card is labelled **Shift Cash Movements (not posted to payment
accounts)** and shows both the as-recorded net and the operating impact, with
the opening float called out as excluded. The amounts are server-computed
(`shiftCash`, `shiftCashBridge`); the page only formats them.

## Verification

`cashflow.core.test.ts` covers the live 200 float / 35 petty-cash-out case
(recorded 165, operating -35), manual in/out, and an empty shift.
