# Promotions - presentation and input hardening

ARGUS #334 collected several presentation and API-input issues.

## Page

- Stat-card copy is customer-facing again; the "If this grows into a monster"
  developer note and the expiry commentary were replaced with plain
  explanations of what each number means.
- The status switch has an accessible name (`Activate/Deactivate <name>`).
- Added search (name, promo code, type), a live-state filter and 10-row
  pagination over the loaded list. The summary cards still describe the whole
  list; the table reports "N of M shown".
- The product picker is now `PromotionProductSelect`: a debounced server-side
  search (`/api/store/products?search=&limit=25`) instead of one
  `limit=1000` fetch. Editing keeps the current product visible even when it is
  outside the first results.

## Promo codes

Promo codes are stored uppercase, matching the uppercase-styled input. New
writes use `normalizePromoCodeForStorage`; matching remains case-insensitive so
old lowercase rows keep working.

## Evaluate endpoint

`EvaluateCartSchema` now rejects, with a 400 field error:

- a non-numeric or negative `unitPrice` (previously reached `Decimal` and
  surfaced as 500);
- a negative `manualDiscountAmount`, or one larger than its line total;
- money above the storage ceiling and quantity outside `1..1,000,000`.

The service still caps the combined discount at the cart subtotal.

## Verification

- `npx tsc --noEmit`
- `npx vitest run src/lib/validators/__tests__/promotion.validators.test.ts src/lib/services/__tests__/promotionValidation.core.test.ts`
