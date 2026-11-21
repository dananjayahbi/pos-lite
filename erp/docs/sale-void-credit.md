# Voiding a sale restores redeemed credit

Voiding a sale reversed stock, payment-account legs, customer spend and
commission, but it did not return store credit or exchange credit that the sale
had redeemed. The customer's balance had been decremented by `redeemCredit` and
simply disappeared when the sale was voided.

## Fix

`voidSale` now reads the sale's `STORE_CREDIT` and `EXCHANGE_CREDIT` payment legs
(the persisted source of truth from the tender split) via
`sumRedeemedCreditLegs` and, when a customer is linked, issues one store-credit
note for the total:

`Void of sale <8-char ref> - restored store/exchange credit`

The original credit note's `usedAmount` stays consumed (truthful history); the
new note restores the spendable balance. The void is idempotent because a sale
can only be voided once, and the issue runs inside the same transaction as the
rest of the reversal.

Admin credit adjustments (`CUSTOMER_CREDIT_ADJUSTED`) are still recorded by
`issueCredit`, so the restored balance remains auditable.

## Verification

`src/lib/services/__tests__/saleTender.core.test.ts` covers the leg split and
the zero-credit case; `tsc` covers the void wiring.
