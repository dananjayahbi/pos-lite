# M02-02 — BUG-2 + BUG-19: product creation reports success while variants silently fail or vanish

**Severity:** P1-Critical (data integrity + misleading success; two faces of one false-success family) · **Module:** 02 Products · **QA pins:** `tests/02_inventory.spec.ts` wizard test (BUG-2 re-pin), E-series API tests (BUG-19) · **Depends on:** INF-02 (error mapping), shares review with M02-01 file set

## Verified source state (2026-09-15) — both still hold
**BUG-2 (wizard ignores 207):**
- `src/app/api/store/products/route.ts:167-176` — when `createProductVariants` throws, the API returns **HTTP 207** `{ success: true, data, warning: { code:'PARTIAL_SUCCESS', message:'Product created but variant creation failed: …' } }`.
- `src/components/wizard/WizardStep3Review.tsx:103-110` — mutationFn checks only `if (!json.success) throw` — `success:true` on a 207 sails through; `onSuccess` (113-117) toasts "Product created successfully". Product listed with 0 variants; detail page shows "No variants found".
**BUG-19 (API drops `variants` key):**
- `src/lib/validators/product.validators.ts:130` — schema key is `variantDefinitions` (optional); Zod default-strips unknown keys (no `.strict()`).
- `route.ts:145,160` — a client sending `variants:[…]` gets `variantDefinitions === undefined` → **201 success, zero variants, no 207, no warning**.

## Fix approach
1. **Wizard:** treat `res.status === 207` or `json.warning?.code === 'PARTIAL_SUCCESS'` as a *partial failure*: show the warning message (product exists, variants failed) and keep the user on review with a "retry variants" path — never a plain success toast. (Client-side check in `WizardStep3Review.tsx`.)
2. **API alias + strictness:** accept `variants` as an explicit alias of `variantDefinitions` in `CreateProductSchema` (transform maps it), and reject *other* unknown top-level keys via `.strict()` — silent-drop is the actual defect. 207 semantics stay (they're documented) but the wizard now honors them.
3. Duplicate-SKU variant failure continues to surface through the existing 207 warning (route already builds the message) — ensure the message text reaches the toast.

## Files
- `src/components/wizard/WizardStep3Review.tsx`, `src/lib/validators/product.validators.ts`, `src/app/api/store/products/route.ts`.

## Acceptance / gate
- `tests/02_inventory.spec.ts`: existing BUG-2 pin (asserts detail page never shows "No variants found" after wizard create) stays green; new assertion — wizard with forced duplicate SKU shows the PARTIAL_SUCCESS warning, not success; API POST with `variants:[…]` → variants actually created (alias) or unknown-key 400 (strict), never silent 201-with-zero.
- Import/export tests (csv negative-price → 400) unaffected.
