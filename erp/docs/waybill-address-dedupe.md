# Waybill address locality is de-duplicated

Sri Lankan addresses often set the city and district to the same locality
(`Colombo, Colombo`, `Deiyandara, Deiyandara`). The live label printed both,
e.g. `Chameera, Deiyandara, Deiyandara, 81320` (ARGUS #302).

## Behaviour

- `dedupeLocality(city, district)` returns one occurrence when the two names
  match case-insensitively, and `city, district` otherwise.
- `buildWaybillAddress()` joins address lines, the de-duplicated locality and
  the postal code. Adjacent identical parts are collapsed too, so an address
  line that already repeats the city does not print it twice.
- The `Branch` row uses the same helper (with a ` / ` separator) so the address
  and branch blocks agree.

## Verification

`src/lib/delivery/__tests__/waybill.test.ts` covers same-city, differing
city/district, a repeated address line, and missing parts.
