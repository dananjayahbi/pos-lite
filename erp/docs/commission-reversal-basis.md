# Commission reversal basis

Commission is earned on the **tax-inclusive sale total** and reversed on the
**tax-inclusive refund total** (ARGUS #345). `Return.refundAmount` already
includes the tax component (`Return.taxAmount`), so both sides use the same
unit: a full return now claws the whole commission instead of leaving the VAT
share behind.

## Rules

- Earning base: `Sale.totalAmount` (stored on `CommissionRecord.baseAmount`).
- Reversal input: the sum of completed `Return.refundAmount` values.
- The refund is scaled by `originalBase / refundableBase`, where
  `refundableBase = Sale.totalAmount - Sale.deliveryCharge`. Delivery is never
  refunded, so this makes a full goods return reverse the whole commission -
  including the part earned on delivery - instead of leaving it behind
  (ARGUS #103). Legacy records whose stored base differs from the current sale
  total still reverse to exactly zero on a full return.
- The reversing row uses the **original commission rate**, never the staff
  member's current rate:
  - one positive original record -> its stored `commissionRate`;
  - mixed/duplicate records -> the earned/base weighted average.
- The reversing `CommissionRecord.createdAt` is the sale's date
  (`completedAt ?? createdAt`), so payroll period reporting nets the clawback
  against the commission it reverses.
- The original (possibly paid) row is never mutated. The negative row stays
  outstanding until a later payout nets it.
- Re-running reconciliation is idempotent: `existingBase` already includes the
  prior negative row, so the next plan is a no-op.

The pure decisions live in
`src/lib/services/commissionClawback.core.ts`:

- `planCommissionReversal({ originalBase, commissionRate, saleBase, returnedBase, ... })`
- `resolveOriginalCommissionRate(records)`
- `resolveOriginalCommissionBase(records)`
- `resolveCommissionSaleDate(sale)`

## Verification

`src/lib/services/__tests__/commissionClawback.core.test.ts` covers a full
VAT-inclusive refund, a partial tax-inclusive refund, a delivery-bearing sale
(full and partial goods returns), a legacy base that differs from the sale
total, historical single/mixed rate selection, positive-base summing, and
sale-date selection.
