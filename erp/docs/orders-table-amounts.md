# Dispatch Orders table amounts

ARGUS #266. The queue previously showed customer, city, items and a "COD"
column that used the goods value only. A prepaid card order and a zero-value
manual order both looked like `Rs. 0.00`, and the operator could not tell how
the order was paid or where it came from.

## Columns

- **Source** - `Website`, `Manual`, `POS`, `Import`.
- **Payment** - method (`COD`, `Card`, ...) with the payment status (`Paid`,
  `Pending`, `Failed`, `Refunded`, `Unknown`) underneath.
- **To collect** - what the courier collects:
  - unpaid orders: goods + stored shipping fee, with the breakdown
    `Goods ... + shipping ...` underneath (or `Goods only` when the shipping fee
    is zero)
  - prepaid orders: the word `Prepaid`, not `Rs. 0.00`, so a paid card order is
    visually distinct from a zero-value COD order

The rule comes from `collectableCodAmount` (ARGUS #288) and is exposed through
`totalToCollect` / `orderAmountSummary` in
`src/components/orders/orderAmount.ts`.

## API mapping

`GET /api/store/deliveries` already returns the full delivery scalar row, so
`source`, `paymentMethod`, `paymentStatus`, `shippingFee` and `declaredValue`
are available. `DeliveryListItem` now includes `declaredValue` as well; no
database change is needed.

Tests: `src/components/orders/__tests__/orderAmount.test.ts` covers goods +
shipping, zero-value manual vs prepaid card, legacy missing shipping and the
source/payment labels.
