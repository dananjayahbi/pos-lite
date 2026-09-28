# M04-02 — BUG-22: brand vs category delete-button UX inconsistency for the same in-use constraint

**Severity:** P3-Minor (UX consistency; no functional impact) · **Module:** 04 Categories & Brands · **QA ref:** `tests/04_categories_brands.spec.ts` L2 (API passes; UI inconsistency observed on inspection) · **Depends on:** nothing

## Verified source state (2026-09-15) — still holds
- Categories: `src/components/categories/CategoryList.tsx:97-100` passes `blockedReason` when `cat._count.products > 0`; `CategoryDeleteButton.tsx:27-47` renders a **disabled Lock icon + tooltip** ("N products assigned — reassign or archive them first").
- Brands: `src/components/brands/BrandList.tsx:93` — `{canDelete && brand._count.products === 0 && (<BrandDeleteButton …/>)}` — delete button **omitted entirely** for in-use brands. No lock, no explanation; the operator can't tell whether the action is forbidden or the UI is broken.
- Same business rule (`*_IN_USE` 409 at the API, both verified green), two UI treatments.

## Fix approach
1. Extract the shared affordance: the disabled-lock-with-tooltip pattern from `CategoryDeleteButton` becomes a small shared component (e.g. `src/components/shared/ResourceDeleteButton.tsx`) taking `canDelete`, `blockedReason`, `onClick`.
2. `BrandList` renders it with the same blocked branch (`brand._count.products > 0` → lock + tooltip). `CategoryList` migrates to the shared component so the two can't drift again.
3. Tooltip copy consistent between the two ("N products assigned — reassign or archive them first").

## Files
- new `src/components/shared/ResourceDeleteButton.tsx`, `CategoryList.tsx`, `CategoryDeleteButton.tsx`, `BrandList.tsx`, `BrandDeleteButton.tsx`.

## Acceptance / gate
- Manual/playwright UI check: `/brands` row with products shows the same disabled lock + tooltip as `/categories` (L2 stays green at API level; add a UI assertion in the relocated spec).
- No API change.
