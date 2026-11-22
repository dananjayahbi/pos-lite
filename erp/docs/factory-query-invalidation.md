# Raw-material mutation cache invalidation

ARGUS #256: creating, editing, deleting or adjusting a raw material
invalidated `raw-materials` and `raw-material-stats` but not
`raw-material-alerts`. The Low-stock KPI and low-stock list refreshed, while the
**Raw material alerts** panel kept serving its 20-second cache. BOM production
already invalidated all three.

## Behaviour

All raw-material mutations now call one shared helper:

```ts
await invalidateRawMaterialSurfaces(queryClient);
```

It invalidates exactly the stock-derived surfaces:

| Query key | Surface |
| --- | --- |
| `raw-materials` | raw-material list and the dashboard low-stock list |
| `raw-material-stats` | dashboard KPI cards |
| `raw-material-alerts` | raw-material alerts panel |

| Mutation | File |
| --- | --- |
| Create / edit | `RawMaterialFormDialog` |
| Adjust stock | `RawMaterialAdjustDialog` |
| Delete | `RawMaterialListClient` |

The key list lives in `src/lib/factory/factoryQueries.ts`
(`RAW_MATERIAL_SURFACE_QUERY_KEYS`), so a new stock-derived surface only has to
be added there. Production keeps its wider invalidation set because it also
touches finished goods, batches and the stock ledger.

## Verification

`src/lib/factory/__tests__/factoryQueries.test.ts` asserts the key list
(includes alerts, excludes the production feed) and that the helper calls
`invalidateQueries` once per key.
