# M06-05 — Supplier archive/search observations: phone not searchable, no unarchive path, archived rows still editable

**Severity:** P2/P3 bundle (product-decision heavy) · **Module:** 06 Suppliers · **QA refs:** OBS-9, OBS-10, OBS-11 (pins A3) · **Depends on:** M06-01 (phone uniqueness interacts with search)

## Verified source state (2026-09-15) — all three hold
1. **OBS-9 (search):** `src/lib/services/supplier.service.ts:144-145` — search `OR` matches `name`/`contactName` **only**; phone is not searchable (verified: exact-phone search → 0 rows), even though phone is the primary contact key and (post-M06-01) a uniqueness field.
2. **OBS-10 (one-way archive):** `UpdateSupplierSchema = CreateSupplierSchema.partial()` (`supplier.validators.ts:21`) and Create has **no `isActive`** → PATCH cannot toggle it. Only archive path is one-way: `api/store/suppliers/[id]/archive/route.ts:36` → `archiveSupplier` sets `isActive:false` (`supplier.service.ts:160`). API supports `includeArchived=true` (`suppliers/route.ts:41`, service `:137`) but the UI page never sends it (`suppliers/page.tsx:76-78` sets only search/page/limit). **No unarchive affordance exists anywhere.**
3. **OBS-11 (archived editable):** `updateSupplier` → `assertSupplierBelongsToTenant` (`supplier.service.ts:10-11`) checks `{id, tenantId}` with **no `isActive` re-check** → archived suppliers remain PATCH-able (A3 pins this as current behavior).

## Fix approach (each is a small, independent decision — flag them together)
1. **Add phone to the search OR-clause** (exact/prefix match alongside name/contactName) — low risk, aligns with the dedupe story. (Contrast: Customer search behavior — keep conventions consistent; note for XC docs.)
2. **Unarchive:** add `POST /api/store/suppliers/[id]/unarchive` (mirror of archive, sets `isActive:true`) + an "Include archived" toggle on the list page + Unarchive button on archived rows (pattern exists for products: `isArchived` toggle). Alternatively extend PATCH to accept `isActive` — prefer the explicit route (audit-friendly: `SUPPLIER_UNARCHIVED` row).
3. **Archived-edit policy:** decide — (a) block PATCH on archived (409/404) to enforce "restore first", or (b) allow (current). Recommend (a) for consistency with the soft-hide intent; flip A3's pin accordingly. Cheap guard: `if (!supplier.isActive) throw 'Archived suppliers must be restored before editing'`.

## Files
- `supplier.service.ts`, `suppliers/route.ts` (UI param), `suppliers/[id]/archive/route.ts` + new `unarchive/route.ts`, `(store)/suppliers/page.tsx` + `SupplierList` row actions, validators if PATCH policy changes.

## Acceptance / gate
- `tests/06`: F7 extended — exact-phone search finds the supplier; A2/A3 updated for the unarchive round-trip + archived-edit policy; sidebar/list shows archived rows only under the toggle. No existing green assertion regresses (A1 includeArchived API semantics preserved).
