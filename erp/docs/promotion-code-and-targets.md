# Promotion targets, promo codes and redemption policy

ARGUS #330. An "active" promotion that can never apply is a silent
configuration error: `PROMO_CODE` could be saved without a code,
`CATEGORY_PERCENTAGE` without a category, and `PRODUCT_PERCENTAGE` /
`PRODUCT_FIXED` without a product. Promo codes had no uniqueness, so duplicate
active `SUMMER10` rows resolved by arbitrary `findFirst`, and there was no
redemption or usage limit.

## Conditional requirements

`src/lib/services/promotionValidation.core.ts` is the single source, used by
the Zod create/update schemas and by `createPromotion` / `updatePromotion`:

| Type | Required |
| --- | --- |
| `PROMO_CODE` | `promoCode` |
| `CATEGORY_PERCENTAGE` | `targetCategoryId` |
| `PRODUCT_PERCENTAGE` / `PRODUCT_FIXED` | `targetProductId` |
| `BOGO` / `MIX_AND_MATCH` | `targetProductId` **or** `targetCategoryId` |
| `CART_PERCENTAGE` / `CART_FIXED` | nothing extra |

The form displays the returned field error. PATCH validates the **effective**
row, so moving only the end date cannot bypass a requirement that the stored
type already has.

## Promo-code uniqueness

Codes are trimmed and compared case-insensitively per tenant
(`SUMMER10` = `summer10`). Create/update take a tenant-row lock
(`lockingTx` + `lockForUpdate`) before the `findFirst` and write, so concurrent
service writes serialize and the loser gets `409 CONFLICT`.

There is no DB unique index on `(tenantId, promoCode)` (schema change not
allowed for this task). The check is therefore service-level: a writer that
bypasses this service, or two app instances if the tenant lock is not honoured,
can still race. The durable fix is a case-insensitive unique index on
`lower("promoCode")` scoped to the tenant (or a normalized code column) plus
the same 409 mapping; document the migration separately if it is approved.

## Redemption / usage cap

The current `Promotion` model has no `redemptionCount`, `maxRedemptions` or
`perCustomerLimit` fields, so no cap can be enforced without a schema change.
Contract for now, with no schema change:

- a promo code is reusable for any number of carts while it is active and
  inside its window;
- operators retire a code with Deactivate (soft `isActive = false`);
- `validatePromoCode` applies one code to the remainder of one cart and never
  tracks customers.

A real usage cap needs schema additions:
`redemptionCount Int @default(0)`, `maxRedemptions Int?`,
`perCustomerLimit Int?`, plus a redemption ledger keyed by
`(tenantId, promotionId, customerId)`. Until then the UI/docs must not claim a
limit exists.

## Verification

- `src/lib/services/__tests__/promotionValidation.core.test.ts`
- `src/lib/validators/__tests__/promotion.validators.test.ts`
