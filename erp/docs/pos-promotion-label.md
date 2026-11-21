# Cart promotion labels are not repeated (ARGUS #71)

The POS totals block lists each applied cart promotion under **Promotions** and
shows its discount amount on the right. The label is the promotion's own name.

A cart-level promotion used to be labelled:

```
10% Off Everything - 10% off cart
```

because `evaluateCartPromotions()` appended the computed offer to the name. That
repeated the same discount twice.

`cartPromotionLabel()` (`src/lib/services/promotion.service.ts`) now trims and
returns the name, falling back to `Cart promotion` when a legacy row has an
empty name. The computed discount (`discountAmount`) is unchanged and still
rendering separately, so the cashier sees one label plus one amount.

## Verification

`src/lib/services/__tests__/promotion-cart-label.test.ts` pins the single-label
output and the empty-name fallback.
