# POS discounts: apply and remove

The POS cart supports two independent discount scopes:

| Scope      | Control                                                 | Store state                                  | API field                 |
| ---------- | ------------------------------------------------------- | -------------------------------------------- | ------------------------- |
| Line item  | `LineItemDiscountControl` (open by clicking a cart row) | `items[].discountPercent`                    | `lines[].discountPercent` |
| Whole cart | `CartDiscountControl` (below the cart lines)            | `cartDiscountPercent` / `cartDiscountAmount` | `cartDiscountAmount`      |

Percent and fixed (Rs.) modes are mutually exclusive per scope — applying one
clears the other on that scope.

## Removing a discount

Both scopes expose an explicit removal path (Issue #6). Previously a line-item
discount could only be _applied_ — the Apply button is disabled for a zero
value, so a discount given to a cart line could never be taken back.

- **Line item:** the cart row shows the discount as a `-N%` chip with its own
  `×` button. Clicking the row opens the editor, which also shows
  `Line discount — applied N% off`, the computed amount, and a
  **Remove discount** action. Both call `setLineDiscount(variantId, 0)`, which
  also re-evaluates promotions.
- **Cart:** once a cart discount is active the header shows **Remove** and an
  `Applied: N% off (Rs. X)` summary. Removing calls
  `setCartDiscount('percent', 0)`.
- **Promo code:** the promo chip has its own `×` (`setPromoCode(null)` followed
  by promotion re-evaluation).

Removal only changes the live cart; completed sales stay immutable and any
discount change requires a new sale (or a return/void flow).

## Verification

`tests/14_pos_billing.spec.ts`:

- `C5 removes an applied cart discount from the POS cart`
- `C6 removes an applied line-item discount from the POS cart`

Store arithmetic is unchanged and remains covered by
`src/stores/__tests__/cartPromotions.test.ts`.
