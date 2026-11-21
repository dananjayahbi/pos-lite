# POS cart tax parity

The POS cart prices a sale the same way the sales API persists it. Before this
change the cart showed `Tax Rs. 0.00` and a pre-tax total while the saved sale
added VAT, so the cashier confirmed one total and the customer was charged a
higher one (ARGUS #60).

## What the cart now does

`getCartTotal()` in `src/stores/cartStore.ts` mirrors `createSale` in
`src/lib/services/sale.service.ts`:

1. Each line total is `unitPrice × quantity`, less the line discount.
2. The manual cart discount **and** the promotion total are combined into one
   discount (`getSaleDiscountAmount`), because that is the single field the
   sales API receives.
3. The combined discount is apportioned across the lines with the shared
   `allocateCartDiscountShares` helper, so each line is taxed on what the
   customer actually pays for it.
4. Each line is taxed by its product's tax rule:
   - `STANDARD_VAT` → tenant `vatRate`
   - `SSCL` → tenant `ssclRate`
   - `EXEMPT` → no tax
5. `total = subtotal − combined discount + tax`.

Store credit is deducted from that total to get the amount due; the cart no
longer subtracts the promotion a second time.

## Where the cart gets its inputs

- **Tax rules** ride along on the cart line (`CartItem.taxRule`), supplied by
  the product grid, the keyboard console, variant selection and barcode scans.
  Older cart snapshots without a rule fall back to `STANDARD_VAT`.
- **Tenant rates** are read from `GET /api/settings/taxes` (any authenticated
  tenant user; writes still require `SETTINGS.manageTax`). `CartPanel` caches
  them for five minutes and syncs them into the cart store so the customer
  display (`/api/cfd/update`) shows the same total.
- A single rate applied to every line is shown in the Tax row label, e.g.
  `Tax (18%)`; mixed or entirely exempt carts show `Tax`.

## Verification

`src/stores/__tests__/cartTax.test.ts` covers standard VAT, promotions taxed
after discount, mixed VAT/exempt carts, SSCL, a fully discounted (zero) cart,
legacy lines without a tax rule, and an arithmetic parity check against the
sales-service formula. The ARGUS #63 scenario (2,098.80 with a 10% promotion ->
tax 340.01, total 2,228.93) is a named regression case.
