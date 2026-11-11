# Product-wise promotions

Promotions on `/promotions` can target a single product in addition to the
existing cart- and category-level scopes.

## Creating one

1. Click **New Promotion**.
2. Choose **Product Percentage** or **Product Fixed** from the type list.
3. Pick the product in the **Product** select.
4. Enter the discount percentage (0–100) for percentage, or the fixed LKR amount
   for fixed, and optionally a validity window.

**Product Fixed** mirrors `CART_FIXED` but is scoped to one product. The flat
amount is applied to each matching product line, capped at that line's total
after manual discounts, so a promotion can never take a line below zero. The
value shares the `Decimal(12,2)` storage ceiling and accepts at most two
decimal places.

The promotion applies to every variant of that product that is in the cart.
The product is shown beneath the promotion name in the list and is editable in
the edit sheet.

## Evaluation order

Promotions are evaluated most-specific first:

1. Customer pricing rules
2. `PRODUCT_PERCENTAGE`
3. `CATEGORY_PERCENTAGE`
4. `BOGO` / `MIX_AND_MATCH`
5. Cart-level promotions (`CART_PERCENTAGE` / `CART_FIXED`)
6. Promo codes

Once a cart line has received a discount, later promotion types skip it. This
means a product promotion wins over a category or cart promotion for the same
line.

## Storage / API

- `Promotion.type` gained `PRODUCT_PERCENTAGE` and `PRODUCT_FIXED`.
- `Promotion.targetProductId` references `products.id` (nullable, indexed).
- `POST/PATCH /api/store/promotions` accept `targetProductId`.
- `GET /api/store/promotions` includes `targetProduct { id, name }`.
- `POST /api/store/promotions/evaluate` resolves each cart variant's parent
  product before applying product promotions.

## Verification

- `src/lib/services/__tests__/promotion-product.test.ts` (percentage and fixed)
- `src/lib/validators/__tests__/promotion.validators.test.ts`
- `prisma/migrations/20261109000000_add_product_fixed_promotion_type` adds the
  enum value for existing databases.
- `tests/15_promotions_pricing.spec.ts` covers the broader promotion contract.
