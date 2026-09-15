# M02-03 — BUG-20: soft-deleted products are unrecoverable (DELETE promises a restore path that doesn't exist)

**Severity:** P2-Major (irreversible data loss from a documented-reversible action) · **Module:** 02 Products · **QA pin:** `tests/02_inventory.spec.ts` E7 · **Depends on:** nothing · **Policy parent:** XC-05 (restore/deprovision policy across entities)

## Verified source state (2026-09-15) — still holds
- `src/lib/services/product.service.ts:469` `softDeleteProduct` sets `deletedAt` on the product (`:483`) **and all its variants** (`:487-488`).
- `getAllProducts` (`:130`) hard-filters `deletedAt: null` (`:135`) **unconditionally** — the `isArchived` filter (`:163-165`) is additive, so `isArchived=true` still excludes soft-deleted rows.
- `archiveProduct` (`:507`) queries `where:{ id, deletedAt:null }` (`:509`) → throws `'Product not found'` → `POST /products/[id]/archive` returns **404** (`api/store/products/[id]/archive/route.ts:57-63`).
- Yet `DELETE /products/[id]` response (`api/store/products/[id]/route.ts:183`) literally says *"Product has been archived. It can be restored by un-setting deletedAt."* — **no route ever clears `deletedAt`.** QA E7 pins all three facts (DELETE 200 + that message; absent from every list; archive-restore 404).

## Fix approach (choose with the client; default = add restore)
1. **Add a restore endpoint:** `POST /api/store/products/[id]/restore` — sets `deletedAt: null` on the product and its variants (mirror of softDelete's scope), tenant-scoped, permission-gated like archive, audit `PRODUCT_RESTORED` with real actor (M03-02 helper). Guard: if the SKU now collides with a live product, return 409 (do not force the operator through raw DB).
2. **UI affordance:** the archived-list view (`/inventory?status=archived`) currently only handles the `isArchived` flag, not `deletedAt`. Decide scope: (a) surface soft-deleted products under a "Deleted" filter with a Restore button, or (b) keep DELETE as the terminal action and **fix the message** to stop promising restorability. Recommend (a) — the message already set the expectation, and audit retention wants soft-delete to be reversible.
3. **Reconcile terminology:** "archived" (`isArchived`) and "deleted" (`deletedAt`) are two different states; the DELETE message conflates them. Align copy across UI + API responses (ties to XC-05's shared policy language).

## Files
- new `src/app/api/store/products/[id]/restore/route.ts`, `product.service.ts` (restore fn + optional deleted-list support), inventory list UI + archive toggle copy, audit constants.

## Acceptance / gate
- `tests/02` E7 flips: after DELETE, the product is listable under a deleted view and `POST /restore` returns it (variants intact, stock unchanged); the DELETE message no longer lies.
- Archive-toggle tests (isArchived both ways) still green; duplicate-SKU-on-restore → 409 not 500.
