# Sale discounts and promotions are server-validated

The sales API no longer trusts client-supplied discounts, promotion records or
manager overrides (ARGUS #321).

## What the server now does

- **Promotion re-evaluation** — when the payload contains `appliedPromotions`
  or a `promoCode`, `createSale` re-runs `evaluatePromotions` against the
  server's variant prices and line discounts. The claimed promotion total must
  match the server total (within one cent); otherwise the sale is rejected with
  `409 PROMOTION_MISMATCH` ("reload the cart"). The server's evaluation is what
  gets persisted in `Sale.appliedPromotions`.
- **Manual discount split** — `cartDiscountAmount` remains the single API
  discount field (manual + promotions). The manual part is
  `cartDiscountAmount − verified promotion total`; it cannot be negative
  (`INVALID_DISCOUNT`) and the combined discount is capped at the subtotal.
- **Cashier thresholds** — `POS_DISCOUNT_THRESHOLDS` is enforced server-side:
  line discounts > 10% or a manual cart discount > 5% require a manager. The
  cashier's own role is read from the DB; an `authorizingManagerId` is accepted
  only if it belongs to the tenant, is active and holds MANAGER/OWNER/SUPER_ADMIN
  (`INVALID_AUTHORIZING_MANAGER` otherwise). Violations return
  `403 DISCOUNT_REQUIRES_MANAGER`.
- **Cash sufficiency** — CASH/SPLIT sales must tender at least the payable
  amount after discounts/credits; otherwise `400 INSUFFICIENT_CASH`. This stops
  a sale from being persisted as fully paid when the submitted cash no longer
  covers the server-computed total.

The UI thresholds are unchanged; the client check is now a convenience only.

## Files

- `src/lib/services/saleDiscountValidation.core.ts` — reconciliation and
  authorization rules (pure, unit-tested).
- `src/lib/services/sale.service.ts` — applies them inside `createSale`.
- `src/app/api/store/sales/route.ts` — maps the new sentinels to typed 400/403/409
  responses.

## Verification

`src/lib/services/__tests__/saleDiscountValidation.core.test.ts` covers promo
summation, matching/mismatched totals, negative manual discounts, subtotal
capping, cashier thresholds and manager override.
