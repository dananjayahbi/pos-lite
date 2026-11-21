# Create Delivery shipping estimate

The Create Delivery sheet previewed only weight + city, kept the previous amount
after an input was cleared, and never showed preview failures. The saved fee
uses city + district, so a district-only override was never previewed
(ARGUS #291).

## Behaviour

- The form now has an optional **District** picker from the synced courier
  districts (the city picker already existed). Selecting a district stores both
  `address.districtId` and `address.districtName`; clearing the city/district
  clears the preview.
- The preview request is built by `buildRatePreviewRequest` and includes weight,
  city and district. It returns `null` (no request) unless weight is positive and
  at least one destination id is resolved.
- `useRatePreview` is a keyed React Query, not a floating mutation: changing
  weight/city/district produces a new key and immediately drops the old amount,
  while an incomplete input disables the query entirely. Out-of-order responses
  can no longer overwrite the current estimate.
- The sheet distinguishes:
  - incomplete: "Enter a weight and choose a city or district..."
  - loading
  - error: message plus a Retry estimate button
  - not configured (from ARGUS #292): "Shipping is not configured..."
  - ready: fee and goods + shipping collectable total
- `POST /api/store/delivery/rate-preview` requires a positive weight and at
  least one destination id, so a request that cannot be priced is a typed 400
  instead of a zero estimate.

Pure request/state logic lives in `lib/delivery/ratePreview.core.ts`.

## Verification

`ratePreview.core.test.ts` covers city+district payloads, district-only,
invalid weight, missing destination, and the loading/error/ready/not-configured
states.
