# Rate-card zone overrides: destination-only, name-based

The zone editor asked for raw origin/destination district and city numeric ids.
The pricing engine resolved overrides by destination only and never read
`originDistrictId`, so an "origin-specific" row silently applied to every origin
(ARGUS #290). A delivery/shipment in this data model stores only the destination
address, so origin-scoped pricing cannot be honoured.

## Behaviour

- The zone matrix no longer has an origin column: it selects **Destination
  District** and **Destination City** by name from the existing synced courier
  locations (`GET /api/store/delivery/locations`). An empty selection means
  "any" (a global fallback row).
- Existing rows that still carry `originDistrictId` are flagged in the page
  with a "Remove origin rows" action; Save is disabled until they are removed.
- `RateCardEntrySchema` rejects a non-null origin with a 400 and an explicit
  message, so a new origin-specific rate cannot be created.
- `PUT /api/store/delivery/ratecard/entries` validates destination ids against
  the synced district/city master list when one is cached. Unknown ids are
  rejected per row/field instead of being stored as a rate that can never match.
  When no locations are cached, existence checks are skipped so the card remains
  editable before courier setup (documented in the page).
- `calculateShippingFee` adds `originDistrictId: null` to every zone lookup
  (city, district, global fallback). Legacy origin-scoped rows therefore never
  apply as a global override while they await cleanup.
- Pure rules live in `lib/delivery/rateZone.core.ts`.

## Verification

`rateZone.core.test.ts` covers origin detection/removal, the origin rejection,
known/unknown destination ids, the entry index in errors, and the no-cache
skip.
