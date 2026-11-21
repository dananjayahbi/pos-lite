# New BOM variant picker

The New Bill of Materials picker listed every product variant, including
traded goods and variants that already owned a BOM. The operator filled in the
whole recipe, then Save failed with a 409 (`BOM_EXISTS`) or 422
(`TRADED_NOT_MANUFACTURED`) (ARGUS #250).

## Behaviour

- The picker is fed by `GET /api/store/bom/eligible-variants`, which returns
  only live **MANUFACTURED** variants with **no BOM row**.
- A variant that already has a (even soft-deleted) BOM is excluded, because the
  `[tenantId, variantId]` unique key would reject the create.
- When no variant qualifies, the dialog explains why instead of showing an
  empty dropdown, and Save stays disabled until a variant is chosen.
- In edit mode the finished product is shown as a read-only field - the
  variant cannot be moved to a different product.
- The server stays authoritative. `createBom` re-checks the variant is
  MANUFACTURED and has no BOM row, so a stale picker (or a direct API call)
  still receives `422` / `409` instead of creating an invalid recipe.

The classification rule is `bomVariantIneligibilityReason()` /
`isVariantEligibleForBom()` in `src/lib/services/bom.core.ts`; the service uses
it to build the picker list.

## Verification

- `src/lib/services/__tests__/bom.core.test.ts` covers eligible, traded,
  existing-BOM and reason-precedence cases.
- `npx tsc --noEmit` verifies the route/hook types.

## Known limitation

A variant whose BOM was soft-deleted keeps the unique BOM slot, so it is
excluded from the picker and cannot get a replacement recipe. Re-creating it
now returns the clear `BOM_EXISTS` 409 instead of a P2002 500. A BOM versioning
or restore flow is required to change that - reported as out of scope.
