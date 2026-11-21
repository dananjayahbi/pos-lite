# Dispatch sheet labels a pre-dispatch waybill as a draft

The sheet's **Waybill** button printed a courier-style label while the delivery
was still `PENDING_DISPATCH`/`AUTO`. The auto waybill is only created by
Dispatch, so the printed label could carry no courier waybill (ARGUS #278).

## Behaviour

- `dispatchWaybillAction(waybillId)` decides the button state. With no waybill
  the button reads **Preview waybill (draft)** and a note explains that Dispatch
  issues the real waybill; the label itself prints the existing `Draft / No
  courier waybill` block instead of a barcode.
- Once `delivery.waybill` (or the shipment's `waybillId`) exists, the button is
  the normal **Waybill** print action.
- The sheet now shows **COD to collect**, **Shipping fee** and **Payment**
  (`COD · Paid`, etc.) above the waybill mode, so the dispatch decision has the
  collection context.

## Verification

`src/lib/delivery/__tests__/dispatchWaybill.core.test.ts` covers the preview and
real-waybill button states.
