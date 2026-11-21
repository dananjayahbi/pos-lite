# Management return refund preview (ARGUS #99)

The **Process Return** sheet (`NewReturnSheet`) now shows what the customer will
get back before the return is submitted.

## Basis

`buildReturnRefundPreview()` in `src/components/returns/refundPreview.ts` wraps
`computeReturnRefund()` — the same pure calculation the return service uses to
persist the refund. The preview therefore uses:

- the line's `lineTotalAfterDiscount` after apportioning the sale's cart-level
  discount (manual + promotions), exactly as `createSale` priced it;
- the line's snapshotted `lineTax` (with the legacy sale-tax apportioning
  fallback);
- the selected return quantity / original line quantity ratio.

It shows:

- a refund amount on each enabled return row;
- Goods (after discounts), Tax refunded, and Total refund for the selection;
- the refund destination (`Cash from the drawer`, `Card reversal · ref`, or
  `Store credit to the linked customer`);
- a neutral “select items” message when nothing is selected (Process Return is
  also disabled).

## Server remains authoritative

The note under the preview says it is informational. The server recomputes the
refund in `initiateReturn`. If the stored `refundAmount` differs from the
preview by more than half a cent (for example a concurrent price/stock change),
the success toast reports both amounts instead of silently claiming the preview
was exact.

## Tests

`src/components/returns/__tests__/refundPreview.test.ts` covers empty selection,
partial single/multi-line returns, cart-discount allocation and a full return
totalling the post-discount goods plus recorded tax.
