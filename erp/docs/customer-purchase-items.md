# Customer purchase history: Items counts units

The customer detail Purchase History table rendered `sale.lines.length` under
the **Items** column, i.e. the number of distinct product lines. A sale with
3 x hair oil and 2 x churna therefore showed **2** instead of **5** (ARGUS #311).

The column now sums each line's `quantity` through the pure `saleItemCount`
helper (`src/components/customers/customerPurchases.ts`), ignoring non-finite
quantities so a malformed row cannot render `NaN`.

## Verification

`customerPurchases.test.ts` covers multi-line sums, multi-unit single lines,
empty/missing line lists and non-finite quantities.
