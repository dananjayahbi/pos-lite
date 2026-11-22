# Pre-dispatch waybill labels are drafts

A delivery without a courier shipment printed its internal order reference in
the TransExpress barcode position, under the courier logo, so an unofficial POD
looked like a courier-issued label (ARGUS #299).

## Behaviour

- `waybillBarcodeValue` returns the courier waybill only. It never substitutes
  the order reference.
- `isDraftWaybill` marks a label without a waybill. The label header then shows
  a bordered **Draft / No courier waybill** marker instead of a barcode.
- Once dispatch creates a shipment and the waybill id is available, the real
  courier barcode renders as before.
- The order reference remains visible as the `Order No` row, not as a barcode.

## Verification

`waybill.test.ts` covers the courier-only barcode and the draft predicate.
