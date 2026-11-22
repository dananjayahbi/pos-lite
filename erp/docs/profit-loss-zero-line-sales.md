# P&L excludes zero-line sales

The September/full-period P&L gross was Rs 10,000 higher than Sales by Product:
four legacy completed CASH sales (4 x Rs 2,500) had a header subtotal but no sale
lines or payments. The P&L summed `Sale.subtotal`, while the product report had
no lines to attribute (and no COGS to deduct), so turnover and profit disagreed
(ARGUS #435).

## Rule

P&L revenue aggregates only completed sales that have at least one line:

- period revenue and revenue-by-payment-method: Prisma `lines: { some: {} }`
- the 12-month monthly revenue query: `EXISTS (SELECT 1 FROM sale_lines ...)`

COGS and returned COGS already join `sale_lines`, so they never included those
sales. Returns are unaffected (the zero-line rows had none).

The invariant from ARGUS #76 now prevents new zero-line completed sales, and
`scripts/repair-zero-line-sales.ts` can void the legacy rows explicitly. This
report change makes both client-facing totals agree immediately, even before
that repair is run.

## Verification

The period/monthly aggregates and the product report now share the same
line-backed revenue basis. `tsc` plus the existing report tests cover the query
shapes; no database fixture was added because the suites are Prisma-mocked.
