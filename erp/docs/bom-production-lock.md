# BOM immutability after production

A bill of materials is the recipe behind a production run. Editing its
ingredient rows after a run rewrites the recipe behind that history, and
deleting it leaves the run with no viewable recipe. Both operations were
reachable from the BOM list for every recipe, including ones with production
logs (ARGUS #248).

## Behaviour

- A BOM with **at least one production log** is locked.
- `PATCH /api/store/bom/:id` and `DELETE /api/store/bom/:id` return
  `409` with code `BOM_LOCKED` and the reason
  `This bill of materials has production runs recorded, so its recipe can no
  longer be edited or deleted.`
- The lock is enforced inside the same transaction that reads the log count, so
  a run logged between the UI check and the save is still refused server-side.
- The BOM list exposes `productionLogCount` per row. When it is greater than
  zero, **Edit** and **Delete** are disabled, carry the same reason as a
  tooltip, and the row shows `Locked - production recorded`.
- **Produce** stays available for locked BOMs - logging another run is allowed.
- A BOM with no production logs keeps the normal Edit/Delete behaviour.

The rule lives in `canModifyBom(productionLogCount)`
(`src/lib/services/bom.core.ts`) and is shared by the service guard, the table
and the tests.

## Verification

- `src/lib/services/__tests__/bom.core.test.ts` covers zero, one, many and
  non-finite counts.
- `src/lib/api/__tests__/map-service-error.test.ts` asserts `BOM_LOCKED` maps
  to 409.

## Future work

Recipes that need a change after production must be duplicated onto a new
variant (or a BOM versioning model must be introduced). Because a variant can
only own one BOM row, that flow is not available yet - see the out-of-scope
note in the change report.
