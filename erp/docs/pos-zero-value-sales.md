# Zero-value sales

A sale whose payable total is Rs. 0.00 completes through the **Zero-Value Sale**
dialog instead of a payment modal. The cashier must pick a reason
(`BANK_PAYMENT`, `PRODUCT_REPLACEMENT`, `COMPLIMENTARY_GIFT`); the API records
`paymentMethod = NONE` and the reason on the sale.

## How the terminal decides

`CartPanel` shows the zero-value button when the **amount due** is ≤ 0, i.e.

```
amountDue = subtotal − cartDiscount + tax − promotionDiscount − storeCredit
```

## What the API must be told (Issue #7)

The API has a single discount channel, `cartDiscountAmount`. The terminal used
to send only the manual cart discount and kept promotions as a separate display
row, so:

- the persisted sale total was higher than the amount the cashier saw, and
- a cart zeroed by a promotion (+ manual discount) was computed as non-zero by
  the API and rejected with
  `NONE_PAYMENT_REQUIRES_ZERO_VALUE` — the “zero value sale is not creating”
  symptom.

`getSaleDiscountAmount()` (`src/stores/cartStore.ts`) folds the promotion total
into `cartDiscountAmount` (capped at the subtotal), so the persisted total equals
the amount due.

## Tax on the discounted amount (Issue #7)

Tax was computed per line **before** the cart discount was applied, so a fully
discounted VAT product still owed tax and could never reach Rs. 0.00. The sale
service now allocates the cart discount across lines
(`allocateCartDiscountShares`) and taxes what is actually charged per line. This
keeps the stored identity:

```
totalAmount = subtotal − discountAmount + taxAmount + deliveryCharge
```

and makes a genuine full-discount cart total exactly zero.

## Verification

- Unit: `src/lib/services/__tests__/saleDiscount.core.test.ts`,
  `src/stores/__tests__/cartSaleDiscount.test.ts`.
- E2E: `tests/14_pos_billing.spec.ts` — `F9` (API reason/replacement rules) and
  `C7` (POS cart → Zero-Value Sale → receipt, cart cleared).
