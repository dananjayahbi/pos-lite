# M21-01 — BUG-55: `GET /api/store/raw-materials/[id]` returns only `{id}` — omits `stockStatus` and the full material state the list provides

**Severity:** P2-Major · **Module:** 21 Factory Raw Materials · **QA pin:** `tests/21_factory_raw_materials.spec.ts` T2 · **Depends on:** nothing

## Verified source state (2026-09-15) — still holds
- `src/app/api/store/raw-materials/[id]/route.ts:146` — GET returns `{ success:true, data: { id: material.id } }`. The comment above (line ~118) labels it a "lightweight existence check" — but the full row IS fetched (140-142) and only `id` is serialized.
- Contrast: list route (`raw-materials/route.ts:54`) → `listRawMaterials` → `rawMaterial.service.ts:94` maps through `toRawMaterialItem` (36-50) producing the **full shape including `stockStatus: getRawMaterialStockStatus(quantity, lowStockThreshold)`** (line 50).
- The UI/detail consumer and QA's low-stock read-back contract expect the single-item endpoint to carry the same state; `readBody.data.stockStatus` was `undefined` (T2's TypeError).

## Fix approach
1. Make the `[id]` GET return `toRawMaterialItem(material)` — reuse the exact service mapper (export it if not already; the adjust route's response should use it too so all three surfaces agree).
2. Keep permissions/tenant-scoping of the route as-is (QA T-series verified those).
3. Check the PATCH/adjust responses in the same file for the same `{id}`-only shape and normalize them to the DTO (single mapping point).

## Files
- `src/app/api/store/raw-materials/[id]/route.ts`, `src/lib/services/rawMaterial.service.ts` (export/reuse `toRawMaterialItem`).

## Acceptance / gate
- `tests/21` T2 flips: single GET returns `quantity`, `lowStockThreshold`, `stockStatus` matching the list row byte-for-byte; LOW/OUT states visible without re-deriving; the rest of the 21 suite (create/list/adjust/RBAC) stays green.
