# Units test coverage

The Units catalog had no spec: suites 21/22 used only the built-in
`KILOGRAMS`/`LITERS`/`UNITS` keys and the core test checked their labels only.
Add/rename/deactivate/delete, the built-in 400, in-use 409, last-unit 409,
usage counts, duplicate names, lazy-seed restoration and label propagation were
uncovered (ARGUS #485).

## Pure modules and specs

| Module | Spec | Covers |
| ------ | ---- | ------ |
| `src/lib/units/unitValidation.core.ts` | `unitValidation.core.test.ts` | normalisation, duplicate name/short label, self-exclusion, alphanumeric name |
| `src/lib/units/unitDeleteGuard.core.ts` | `unitCatalogGuards.core.test.ts` | built-in 400, in-use 409, last-unit 409 and their precedence |
| `src/lib/units/unitSeed.core.ts` | `unitCatalogGuards.core.test.ts` | reviving only soft-deleted built-ins |
| `src/lib/units/unitUsage.core.ts` | `unitUsage.core.test.ts` | live + archived usage copy |
| `src/lib/services/rawMaterialUnitCapabilities.core.ts` | `rawMaterialUnitCapabilities.core.test.ts` | UI action matrix incl. built-in deletion |
| `src/lib/services/rawMaterialUnitCatalog.core.ts` | `rawMaterialUnitCatalog.core.test.ts` | label propagation for active/inactive/deleted units |
| `src/lib/services/rawMaterialUnitRename.core.ts` | `rawMaterialUnitRename.core.test.ts` | rename confirmation / display-only warning |

The service now delegates the delete and seed decisions to these pure modules,
so the tests protect the real server paths rather than a parallel copy.

## Verification

`npx vitest run src/lib/units/__tests__ src/lib/services/__tests__/rawMaterialUnit*.test.ts`
covers the suite above; `tsc --noEmit` passes. DB-only integration (actually
writing rows) is exercised by the route contract, not mocked here.
