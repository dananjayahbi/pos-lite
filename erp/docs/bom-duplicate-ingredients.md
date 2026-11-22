# Duplicate BOM ingredients

The New/Edit Bill of Materials form let the same raw material appear on two
ingredient rows. The database composite unique constraint
(`bill_of_materials_items @@unique([bomId, rawMaterialId])`) rejected the save
with an unmapped Prisma P2002, so the operator saw a generic 500 (ARGUS #249).

## Behaviour

- `POST /api/store/bom` and `PATCH /api/store/bom/:id` reject a payload whose
  ingredients repeat a `rawMaterialId` with
  `400 VALIDATION_ERROR` and
  `Ingredient already added - each raw material can appear only once.`
- The Zod schemas (`CreateBomSchema`, `UpdateBomSchema`) apply the same rule, so
  the request fails before the service or the database.
- The service checks again before writing (`INGREDIENT_DUPLICATE`), covering
  internal callers that bypass the HTTP layer.
- If a duplicate still reaches the database, the route's Prisma fallback maps
  P2002 to a `409` conflict instead of a 500.
- In the form, raw materials already used on another row are disabled in the
  picker, and Save is refused with the same message if a duplicate slip through.

The shared rule is `findDuplicateRawMaterialIds(ingredients)` and the message
constant `INGREDIENT_DUPLICATE_MESSAGE` in
`src/lib/services/bom.core.ts`.

## Verification

- `src/lib/services/__tests__/bom.core.test.ts` covers repeated ids, ordering
  and empty placeholder rows.
- `src/lib/validators/__tests__/bom.validators.test.ts` covers the create and
  update schemas.
- `src/lib/api/__tests__/map-service-error.test.ts` asserts
  `INGREDIENT_DUPLICATE` maps to 400.
