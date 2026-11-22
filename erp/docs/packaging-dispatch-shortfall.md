# Short packaging stock blocks dispatch

Auto-deduct packaging used `min(configured, stock)`, returned an
`insufficient` flag, and let dispatch continue with only a warning. A parcel
could therefore leave with missing packaging and no explicit decision by the
operator (ARGUS #282).

## Behaviour

- `dispatchDelivery` runs a preflight against the same per-parcel plan before
  contacting the courier. If any selected item is short, it throws a typed
  `409 PACKAGING_SHORTFALL` whose `details.items` list the item name, required
  units and available units.
- No waybill is issued for a blocked dispatch.
- `POST /api/store/deliveries/[id]/dispatch` accepts
  `allowPackagingShortfall: true`. That is the only way to proceed: the service
  still deducts the available units, records the consumptions, and keeps the
  low-stock notification. The override is explicit per request.
- The enforcement runs again inside the dispatch transaction (`autoDeductPackaging`),
  so a race that empties the shelf after the preflight rolls the transaction
  back instead of silently under-deducting.
- The dispatch sheet renders the typed shortfall with an acknowledgement
  checkbox; until it is ticked, the next dispatch request omits the override and
  is blocked again.
- Redelivery keeps its historical best-effort behaviour and passes the override
  explicitly, because the recovery flow has no override control yet.

The pure block/override rule is `decidePackagingShortfall` in
`lib/services/packaging.core.ts`.

## Verification

`packaging.core.test.ts` covers the blocked, sufficient, explicit-override and
no-packaging-selected cases.
