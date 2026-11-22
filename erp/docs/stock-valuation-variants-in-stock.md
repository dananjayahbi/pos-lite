# "Variants in Stock" counts stocked variants (ARGUS #222)

The metric counted every live variant of a non-archived product regardless of
quantity, while its label said "in stock" and the table header said only
"Variants".

- `isVariantInStock(quantity)` in `src/lib/pricing/valuationTotals.core.ts`
  returns true only for a finite quantity above zero.
- The valuation endpoint increments a category's `variantCount` only for stocked
  variants; the KPI card, CSV `Variants in Stock` column and totals row all use
  that count.
- The category table header now reads **Variants in Stock**, matching the card
  and CSV.
- A sold-out variant still contributes its SKU row and `0.00` value, but it no
  longer inflates the count.
- `valuationTotals.core.test.ts` pins zero, negative and non-finite quantities.
