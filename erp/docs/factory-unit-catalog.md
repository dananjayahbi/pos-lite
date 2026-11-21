# Factory surfaces resolve unit labels from the tenant catalog

Factory views hard-coded the three built-in units (`kg`, `L`, `unit`) while raw
material quantities, alerts and production lines can use any tenant-defined
unit. A custom unit's label was therefore wrong on those surfaces, and a
deactivated unit fell back to its raw key (ARGUS #481).

## One resolver

`buildRawMaterialUnitCatalog` and `resolveRawMaterialUnitLabels`
(`src/lib/services/rawMaterialUnitCatalog.core.ts`) are the only lookup rule.
`listRawMaterialUnitCatalog(tenantId)` loads **every** unit row for the tenant,
including inactive and soft-deleted rows, so a material that still references a
key keeps resolving to its tenant label instead of the raw key. A live row wins
if the same key appears twice.

Unknown keys still fall back readably: a humanised name and the raw key as the
short label. Selection inputs (`listRawMaterialUnitOptions`) remain active-only;
the catalog is for display/history resolution, not for offering disabled units
on new material forms.

## Surfaces updated

| Surface | Before | Now |
| --- | --- | --- |
| Factory dashboard low-stock rows | `getUnitShortLabel(material.unit)` | `material.unitShortLabel` from the resolver-backed list |
| Low-stock alerts panel | `getUnitShortLabel(alert.unit as ...)` | `alert.unitShortLabel` returned by the alert service |
| Raw-material adjust dialog | `getUnitLabel(material.unit)` | `material.unitName` from the resolver-backed item |
| Production log consumption | `getUnitShortLabel(line.unit as ...)` | `line.unitShortLabel` attached by `planProduction` |
| Low-stock notification body | `getUnitShortLabel(alert.unit)` | `alert.unitShortLabel` |

The raw-material list/detail and update responses use the same catalog through
`getRawMaterialUnitMap`, which now includes inactive units; the detail API also
passes the resolved labels (previously it returned the raw unit name/key).

## Verification

`src/lib/services/__tests__/rawMaterialUnitCatalog.core.test.ts` covers active
custom labels, deactivated units, soft-deleted historical units, tenant
renames, duplicate live/deleted rows, unknown keys and a missing catalog. The
existing raw-material and alert tests still pass.
