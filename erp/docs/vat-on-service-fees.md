# VAT is charged on the courier service, not gross COD

Reconciliation deducted `VAT% x gross COD` (plus commission), while the rate
card only said "VAT Rate (%)" without stating a basis. At 18% on Rs 10,000 COD
that charged Rs 1,800 instead of Rs 99 on the actual service fees (ARGUS #293).

## Agreed basis

```
commission = gross COD x COD%
VAT base   = delivery fee + commission
VAT        = VAT base x VAT%
net payout = gross COD - delivery fee - commission - VAT
```

At Rs 10,000 COD, Rs 250 delivery fee, 3% commission and 18% VAT:

- commission = 300
- VAT base = 550
- VAT = 99
- net payout = 9,351

The courier never collects VAT on the customer's cash; VAT applies to the
service it charges for.

## Behaviour

- `lib/delivery/courier-fees.core.ts` is the single pure implementation
  (`computeCourierFeeBreakdown`), rounding each monetary component to 2dp before
  summing so the stored commission/VAT and the net reconcile exactly.
- `computeNetPayout` delegates to it (kept for existing callers).
- `computeNetPayoutBreakdown` now returns `vatBase` alongside the commission,
  VAT and delivery fee, and `auditDeductionCompliance` compares the courier's
  deduction against the same service-fee total.
- The Rate Card UI labels the field **VAT on Service Fees (%)** and states
  "Applied to the delivery fee + COD commission, not to the cash collected."
  COD Commission is labelled as charged on gross COD.
- Reconciliation ledger fields (`codCommissionAmount`, `vatAmount`,
  `expectedNetPayout`) are written from the same breakdown.

## Verification

`courier-fees.core.test.ts` covers the Rs 10,000 / 18% example, commission-only
VAT base, no configured percentages, 2dp rounding, and negative-percentage
guarding. `reconciliation-finance.test.ts` covers the delegated net payout.
