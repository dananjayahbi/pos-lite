# Built-in units are protected from deletion and restored by the seed

The built-in guard only covered deactivation. On a tenant with no materials,
deleting "Liters" soft-deleted it, and the lazy seeder could not recreate it
while the deleted row still owned the unique key — it stayed gone until someone
re-added the same name. Usage also ignored archived materials (ARGUS #483).

## Behaviour

- `deleteRawMaterialUnit` throws `BUILT_IN_UNIT` (400) for the three built-ins,
  matching the capability rule in the Units table.
- `ensureDefaultRawMaterialUnits` runs `createMany(skipDuplicates)` and then
  revives any built-in row with `deletedAt != null` (clearing `deletedAt`,
  setting `isActive = true`). Renamed labels on that row are preserved.
- Usage now returns both counts: `usageCount` (live materials) and
  `archivedUsageCount`. The Units table renders
  `1 material (4 archived)` via `formatUnitUsage()`.
- Deletion is still blocked only by **live** usage; archived references are
  disclosed, not treated as blockers, and the label catalog keeps resolving
  deleted units.

## Verification

`rawMaterialUnitCapabilities.core.test.ts` covers built-in deletion and
`unitUsage.core.test.ts` covers the archived usage copy.
