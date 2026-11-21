# Raw-material adjustments require a reason and have a history view

The adjustment dialog took only a signed quantity and an optional free-text
reason. Nothing enforced a reason server-side, and there was no per-material
history even though the audit row stored delta/before/after (ARGUS #246).

## Fixed reason vocabulary

`src/lib/services/rawMaterialAdjustment.core.ts` defines the only accepted
values:

| Value        | Label      |
| ------------ | ---------- |
| `purchase`   | Purchase   |
| `production` | Production |
| `wastage`    | Wastage    |
| `correction` | Correction |
| `return`     | Return     |

- `AdjustRawMaterialStockSchema.reason` is a required `z.enum(...)`, so the API
  returns 400 `VALIDATION_ERROR` when it is missing or unknown.
- `adjustRawMaterialStock` re-checks `isRawMaterialAdjustmentReason` and throws
  `INVALID_REASON` (mapped to 400) for any internal caller that bypasses the
  validator.
- The dialog shows a required reason select and blocks submit until one is
  chosen.

## Persistence and history

There is no raw-material movement table in the schema, and this task must not add
one. The durable history is therefore the existing audit trail:

- `adjustRawMaterialStock` writes `RAW_MATERIAL_STOCK_ADJUSTED` with
  `quantityDelta`, `quantityBefore`, `quantityAfter` (four-decimal strings) and
  `reason`.
- `GET /api/store/raw-materials/[id]/adjustments` projects those rows for one
  material, newest first, resolves actor names, and tolerates legacy rows whose
  reason was free text (shown verbatim as `reasonText`).
- The list row now has a **History** action opening
  `RawMaterialHistoryDialog`, which shows when, reason, change, before, after and
  who.

The audit row is the source of truth; there is no duplicate ledger to drift.

## Verification

`src/lib/services/__tests__/rawMaterialAdjustment.core.test.ts` covers the five
reasons, rejection of free text/empty/non-strings, audit-row mapping, a legacy
free-text reason and malformed/missing audit JSON.
