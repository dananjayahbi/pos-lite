# Sales Items column counts units (ARGUS #81)

The Sales ledger's **Items** column showed `sale.lines.length`, so a sale with
one line of quantity 2 read as `1`. Operators reconcile this column against
stock and receipts, where the number means units.

The column now shows `saleUnitCount(lines)`, the sum of every line's quantity.
A single line with quantity 2 reads `2`. The line count is still available as a
tooltip ("1 line") so the distinction stays visible.

`src/components/sales/saleDisplay.ts` holds the pure helpers:

- `saleUnitCount(lines)` - sum of quantities (non-finite values count as 0)
- `saleLineCount(lines)` - number of lines (the previous value)

Tests: `src/components/sales/__tests__/saleDisplay.test.ts`.
