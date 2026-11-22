# Restoring a soft-deleted BOM

`BillOfMaterials` is soft-deleted, and `[tenantId, variantId]` is unique. After a
delete, the variant stayed hidden from the New BOM picker and `createBom`
returned `BOM_EXISTS`, so that variant could never get a recipe again.

## Behaviour

- `bomCreateDecision(existing)` returns `create`, `exists` or `revive`.
- A live BOM is still a 409 `BOM_EXISTS`.
- A soft-deleted BOM is revived inside the create transaction: `deletedAt` is
  cleared, `isActive` is restored, and the ingredient rows are replaced with the
  submitted recipe. The response is the normal BOM detail.
- The eligible-variants query counts only live BOMs, so a variant whose BOM was
  deleted appears in the picker again.
- A `BOM_RESTORED` audit row records the actor, the variant and the revived id.

## Verification

`bom.core.test.ts` covers the create/exists/revive decisions. The service path is
type-checked by `tsc` and exercised by the existing BOM suite.
