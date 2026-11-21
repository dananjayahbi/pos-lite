# Promotion stacking

Percentages are applied **sequentially to the remaining amount**, and the
combined discount can never exceed the cart subtotal (ARGUS #322).

## Rule

1. Customer pricing, product, category and BOGO/mix-and-match promotions apply
   first; line-level promotions are exclusive per line (the existing
   `alreadyDiscounted` set).
2. The best cart-level promotion applies to the remaining subtotal after step 1,
   not the original subtotal.
3. A promo code applies to what remains after the cart promotion.
4. Each step is capped at the amount left; the final total is clamped to the
   subtotal.

Implementation: `remainingAfterDiscounts`, `applyPercentageToRemaining` and
`applyFixedToRemaining` in `src/lib/services/promotionStacking.core.ts`, used by
`evaluatePromotions` / `evaluateCartPromotions` / `validatePromoCode`.

## Example

2 x Mahanarayan 100 ml = Rs 4,197.60 with a 15% category promotion, a 10% cart
promotion and a 10% code:

| Step          | Base      | Discount |
| ------------- | --------- | -------- |
| Category 15%  | 4,197.60  | 629.64   |
| Cart 10%      | 3,567.96  | 356.80   |
| Code 10%      | 3,211.16  | 321.12   |
| **Total**     |           | **1,307.56 (31.15%)** |

Previously the three percentages were each computed from 4,197.60 and summed to
1,469.16 (35%), over-discounting by Rs 161.61. Without the code, cart + code in
the POS path now gives 19.0% instead of 20.0%.

The Promotions page states this rule next to the header so operators know how
stacked offers combine.

## Verification

`src/lib/services/__tests__/promotionStacking.core.test.ts` covers the reported
example, sequential 10% + 10%, percentage/fixed caps and a non-negative
remainder.
