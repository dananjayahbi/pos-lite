# Receipt identity is current, not snapshotted

Thermal and return receipts read the store identity (name, address, phone, logo,
footer) from the current `Tenant` row at render time. The sale's own data is
snapshotted, but a renamed store, changed address or new footer therefore
changes an old receipt when it is reprinted (ARGUS #472).

## What is already snapshotted

- `SaleLine.productNameSnapshot`, `variantDescriptionSnapshot`, `unitPrice`,
  discount and `lineTax` - the printed item description and amounts.
- `Sale.subtotal`, `discountAmount`, `taxAmount`, `totalAmount`,
  `deliveryCharge` - the printed totals.
- `Sale.createdAt` / `completedAt` and the cashier relation - the printed date
  and operator.

The renderers already use these; a reprint does not re-price the sale.

## What is not snapshotted

Store identity has no schema home. `Sale` has no JSON metadata column (only
`appliedPromotions`, which belongs to promotions and must not be reused), and
`Tenant.settings` holds only the current profile. Closing this properly needs a
migration adding an explicit receipt-identity snapshot (name/address/phone/
logo/footer, or a versioned identity reference) captured in `createSale`.

## What this change does

- Receipt routes accept `?reprint=1`.
- Reprint buttons in the sale history (`SaleDetailModal`) and return history
  (`ReturnDetailModal`) add that parameter.
- The original print after a sale (`ReceiptPreviewDialog`,
  `ReturnReceiptDialog`) does not, so a first print is not labelled as a
  reprint.
- Both renderers show: **Reprint - store details reflect the current profile,
  not the values at the time of sale.** The sale's snapshotted lines, totals
  and tax amount are unchanged.

This is an explicit caveat, not a substitute for the missing snapshot.

## Verification

`src/lib/__tests__/receipt-identity.core.test.ts` pins the notice and the
`?reprint=1` parsing. `receipt-renderer.test.ts` and
`return-receipt-renderer.test.ts` assert the caveat appears only on a reprint
and that line snapshots and the snapshotted tax amount still print.
