# Promotion audit actors and usage

ARGUS #331. Promotion writes were logged as `actorId: null` /
`actorRole: SYSTEM`, customer-pricing rule changes wrote no audit row at all,
and the promotions list had no indication of how often a promotion was used
even though sales already store the applied promotion records.

## Audit contract

`createPromotion`, `updatePromotion`, `setPromotionActive` (activate /
deactivate) and the customer-pricing rule create/update/deactivate routes now
receive the signed-in route actor:

- `actorId` = `session.user.id`
- `actorRole` = `session.user.role`

Actions:

| Entity | Action |
| --- | --- |
| Promotion | `PROMOTION_CREATED`, `PROMOTION_UPDATED`, `PROMOTION_ACTIVATED`, `PROMOTION_ARCHIVED` |
| Customer pricing rule | `CUSTOMER_PRICING_RULE_CREATED`, `CUSTOMER_PRICING_RULE_UPDATED`, `CUSTOMER_PRICING_RULE_DEACTIVATED` |

Create logs an `after` snapshot; update and status changes log `before` and
`after` snapshots with the invariant fields (name, type, value, code, targets,
quantity, window, active flag, description / tag, variant, price). Internal
callers that omit the actor keep the explicit `SYSTEM` fallback.

## Usage count

`Sale.appliedPromotions` is the existing JSON record of the server-evaluated
discounts. `getPromotions()` derives a read-only usage summary from non-voided
sales:

- `usageCount` = number of sales whose `appliedPromotions` includes the
  promotion id;
- `usageDiscountTotal` = sum of that promotion's recorded discount amounts.

`src/lib/services/promotionUsage.core.ts` is pure and ignores malformed JSON.
No schema field, counter or backfill is involved. The promotions table shows
the count in the **Usage** column as `N sales`.

## Verification

- `src/lib/services/__tests__/promotionUsage.core.test.ts`
- `npx tsc --noEmit`
