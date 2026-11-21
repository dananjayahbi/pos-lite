# Waybill order description names the product

The fixed POD printed only the item count and weight (`1 item · 1.50 kg`), even
though product names and SKUs are recorded on the delivery (ARGUS #307). A
courier or customs officer could not identify a generic parcel.

## Behaviour

- The delivery list query now includes the first ordered line
  (`productNameSnapshot`, `skuSnapshot`) for the waybill.
- `formatWaybillItem(name, sku)` renders `Herbal Soap (HB-01)`, degrades to the
  name or SKU alone, and returns an empty string when both are missing.
- `buildWaybillDescription()` appends the first item after the count and
  weight: `1 item · 1.00 kg · Herbal Soap (HB-01)`.
- Deliveries without line items keep the existing count/weight description, so
  no empty separator is printed.

## Verification

`src/lib/delivery/__tests__/waybill.test.ts` covers the full description,
name-only, SKU-only and blank item cases.
