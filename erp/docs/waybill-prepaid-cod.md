# Prepaid orders are not sent as COD

A card order that is already paid must reach the courier with **COD 0** and a
**PREPAID** waybill marker (ARGUS #297). Previously the waybill printed
`Delivery.codAmount` and the courier mapper sent it unconditionally, so
ORD-2026-000033 (CARD, PAID, OUT_FOR_DELIVERY) instructed the courier to collect
Rs 1,590.00 a second time.

## Why the stored amount stays

`Delivery.codAmount` doubles as the order's goods value: `order-payment.service`
uses it as the PayHere amount and the order invoice uses it in the totals. It is
therefore **not** zeroed in the database. The courier-facing view is computed
instead.

## Rule

`src/lib/delivery/cod.ts`:

- `isPrepaidOrder(delivery)` — `paymentStatus === 'PAID'`.
- `collectableCodAmount(delivery)` — `0` for prepaid orders, otherwise the
  recorded `codAmount` (never negative).

Used by:

- `toCourierOrderPayload` (`src/lib/courier/mappers.ts`) — every courier
  adapter receives `cod: 0` for prepaid orders. Dispatch and redelivery pass
  `paymentStatus` through.
- `ShippingLabel` — the COD row prints `PREPAID` instead of an amount for a
  paid order (otherwise the collectable amount).
- `OrderInvoice` — the COD Amount row is hidden for card/paid orders; the
  payment method/status block already shows "Paid".

Unpaid COD orders are unchanged: they still collect the full recorded amount,
and the reconciliation ledger continues to create expected-COD entries only for
`paymentMethod = COD` and unpaid orders.

## Legacy data

Existing CARD/PAID deliveries keep their `codAmount` (three rows on the live
tenant); they now print/send as prepaid without a data migration.

## Verification

`src/lib/courier/__tests__/mappers.test.ts` covers paid -> 0, unpaid COD ->
amount, and the `collectableCodAmount` edge cases.
