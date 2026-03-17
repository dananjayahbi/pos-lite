# Task 05.01.03 — Build Profit and Loss Report

## Metadata

| Field        | Value                                                                        |
|--------------|------------------------------------------------------------------------------|
| SubPhase     | 05.01 — Reporting and Analytics                                              |
| Phase        | 05 — The Platform                                                            |
| Complexity   | Complex                                                                      |
| Dependencies | 05.01.02 (ReportLayout), Sale, SaleLine, Return, ReturnLine, Expense models  |

---

## Objective

Build the Profit and Loss report page at `/dashboard/[tenantSlug]/reports/profit-loss`, computing Revenue, Cost of Goods Sold, Gross Profit, Expenses, and Net Profit for the selected date range, with a structured P&L table and a monthly gross-profit bar chart.

---

## Context

The P&L report is the financial centrepiece of the reporting suite. Owners make pricing, staffing, and purchasing decisions based on whether the business turned a net profit or loss. Three separate Prisma queries produce the three main figures: a revenue aggregate from `Sale` and `Return` records, a raw SQL aggregation of COGS from `SaleLine` and `ReturnLine`, and an expense aggregate from `Expense`. All monetary arithmetic uses `decimal.js` to ensure cent-accurate results.

---

## Instructions

**Step 1: Create the page file and initial server query**

Create `src/app/(dashboard)/[tenantSlug]/reports/profit-loss/page.tsx` as a Server Component. Extract `tenantSlug` from `params` and `from`/`to` from `searchParams`, defaulting to the last 30 days if absent. Resolve the `tenantId` by looking up the tenant record in Prisma by `slug`.

**Step 2: Query Revenue**

Use `prisma.sale.aggregate` with a `where` clause filtering `tenantId`, `status: "COMPLETED"`, and `createdAt` between `from` and `to` (cast as `Date` objects). Select `_sum: { totalAmount: true }` and `_count: { id: true }`. This produces the gross revenue figure and total transaction count.

Next, query `prisma.return.aggregate` in the same date range with `status: "COMPLETED"` to obtain the total refunded amount (`_sum: { refundAmount: true }`). Net Revenue is Gross Revenue minus total refund amount. Compute this subtraction using `new Decimal(grossRevenue).minus(totalRefunds)`.

Then, break revenue down by payment method using `prisma.sale.groupBy` with `by: ["paymentMethod"]`, the same `where` clause, and `_sum: { totalAmount: true }`. This produces the per-method split for the revenue section rows (Cash, Card, QR, etc.).

**Step 3: Query Cost of Goods Sold with prisma.$queryRaw**

Because COGS requires multiplying two columns (`costPriceSnapshot × quantity`) and summing the result across many rows — an operation not natively expressible in Prisma's typed aggregate API — use `prisma.$queryRaw` with a parameterised SQL template. The query must join `SaleLine` to `Sale` filtering on `tenantId`, `Sale.status = 'COMPLETED'`, and `Sale.createdAt` between the from and to dates. The SELECT should produce `SUM(sl."costPriceSnapshot" * sl."quantity")` as `cogs`.

For returned lines, run a second `prisma.$queryRaw` joining `ReturnLine` to `Return` with the same date range and `Return.status = 'COMPLETED'`, returning `SUM(rl."costPriceSnapshot" * rl."quantity")` as `returnedCogs`. Net COGS equals raw COGS minus returned COGS, again computed with `decimal.js`.

All values passed into `$queryRaw` must use the `Prisma.sql` tagged template and typed parameters. Never interpolate user input directly into the SQL string.

**Step 4: Query Expenses**

Use `prisma.expense.groupBy` with `by: ["category"]`, filtering `tenantId` and `date` between the from/to range. Select `_sum: { amount: true }` to produce a table of expense categories with their totals. Also call `prisma.expense.aggregate` for the overall total to use in the Net Profit calculation.

**Step 5: Compute summary figures**

With all three data sets collected, compute the following using `decimal.js` chaining:
- Gross Profit = Net Revenue minus Net COGS.
- Net Profit = Gross Profit minus Total Expenses.
- Gross Margin % = (Gross Profit divided by Net Revenue) multiplied by 100, formatted to one decimal place.
- Net Margin % = (Net Profit divided by Net Revenue) multiplied by 100.

Serialise all `Decimal` values to plain strings for passing to client components, as `Decimal` objects are not serialisable across the server–client boundary.

**Step 6: Query monthly data for the bar chart**

To provide historical context, run a `prisma.$queryRaw` query that groups `Sale` records by calendar month (using `DATE_TRUNC('month', "createdAt")` in PostgreSQL) over the prior 12 months (regardless of the selected date range filter). Return columns `month` and `grossRevenue`. Run a parallel query for `SaleLine` COGS grouped by the same monthly buckets. Compute monthly gross profit per bucket and pass the array to the chart component.

**Step 7: Build the P&L table UI**

In the client portion (or a dedicated `ProfitLossTable` client component), render a structured table with:
- A "Revenue" section header row, followed by sub-rows for each payment method and a "Less: Returns" row, ending with a "Net Revenue" subtotal row.
- A "Cost of Goods Sold" section header, one row for "COGS", one for "Less: Returned COGS", ending with "Net COGS" subtotal.
- A "Gross Profit" row spanning the full width, with the value in bold and coloured green if positive, red if negative.
- An "Expenses" section header followed by one row per expense category, ending with "Total Expenses" subtotal.
- A final "Net Profit" row in larger font, bold, green or red according to sign.

All monetary values in the table must use `font-mono` (JetBrains Mono) and right-align in their column. Use the `mist #D1C7BD` colour for section header rows and `pearl #F1EDE6` for alternating data rows.

**Step 8: Build the Monthly Gross Profit bar chart**

Create a `MonthlyProfitChart` client component. Render a `Recharts ResponsiveContainer` containing a `BarChart` with:
- X-axis: month label formatted as "MMM YYYY".
- Y-axis: gross profit value formatted with a "LKR" prefix.
- One `Bar` using fill colour terracotta `#A48374`.
- A `Tooltip` showing "Gross Profit: LKR X,XXX.XX".
- A `CartesianGrid` with light mist stroke for readability.

**Step 9: Connect ReportContext**

After computing the flat summary data array, call `setReportData` from `useReportContext` so the Export controls in `ReportLayout` have access to the report rows when the user triggers a download.

---

## Expected Output

- P&L page loads and displays three sections: Revenue, COGS, and Expenses, with all subtotals.
- Gross Profit and Net Profit rows change colour based on sign.
- The monthly bar chart shows up to 12 months of gross profit history.
- All monetary values are cent-accurate (no floating-point rounding errors visible).
- Changing the date range via the `ReportLayout` picker triggers a page re-render with updated figures.

---

## Validation

- [ ] Revenue figure matches the sum of `Sale.totalAmount` for the period queried directly in Prisma Studio.
- [ ] COGS figure matches a manual spot-check of `SaleLine.costPriceSnapshot × quantity` for a known sale.
- [ ] Net Profit turns red when expenses exceed gross profit.
- [ ] `prisma.$queryRaw` uses parameterised inputs (no raw string interpolation of `tenantId` or dates).
- [ ] The bar chart renders correctly with no "NaN" or undefined Y-axis values.
- [ ] The report loads in under 3 seconds for a dataset of 1,000 sales.
- [ ] Monetary values display with exactly two decimal places throughout the table.

---

## Notes

- If `SaleLine.costPriceSnapshot` is `null` for legacy records, treat those rows as zero cost in the COGS sum. The `COALESCE("costPriceSnapshot", 0)` function should be applied inside the raw SQL.
- The Gross Margin % and Net Margin % stats may be displayed as small stat cards above the P&L table for quick executive-level scanning.
- COGS and revenue queries must both filter on `Sale.status = 'COMPLETED'` to avoid including voided or pending sales in the report figures.
