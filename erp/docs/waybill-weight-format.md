# Waybill weight formatting is consistent

The Order Description switched between omitting the weight, `1 kg` and
`1.5 kg` for the same field (ARGUS #303). The courier could not tell a
genuinely light parcel from a missing weight.

## Behaviour

- `formatWaybillWeight()` prints exactly two decimals (`1.50`), rounds
  half-up, and returns `null` for null, blank, negative or non-numeric input.
- `buildWaybillDescription()` always includes a weight part when the weight
  field is shown: `2 items · 1.50 kg`, or `1 item · weight n/a` when the
  delivery has no recorded weight.
- The item count keeps its existing singular/plural wording.

## Verification

`src/lib/delivery/__tests__/waybill.test.ts` covers whole, fractional and
missing weights plus the explicit `weight n/a` output.
