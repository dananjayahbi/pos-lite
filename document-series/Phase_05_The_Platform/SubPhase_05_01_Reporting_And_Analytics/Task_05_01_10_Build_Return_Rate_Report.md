# Task 05.01.10 — Build Return Rate Report

## Metadata

| Field        | Value                                                                  |
|--------------|------------------------------------------------------------------------|
| SubPhase     | 05.01 — Reporting and Analytics                                        |
| Phase        | 05 — The Platform                                                      |
| Complexity   | Moderate                                                               |
| Dependencies | 05.01.02 (ReportLayout), Return, ReturnLine, Sale, SaleLine, Product, ProductVariant, Category models |

---

## Objective

Build the Return Rate report at `/dashboard/[tenantSlug]/reports/returns`, showing overall and category-level return rates, a return-reason breakdown donut chart, and the top 10 most-returned products.

---

## Context

Returns are costly: they consume staff time, require restocking, and reduce net revenue. Understanding which categories and products drive returns — and why — lets the owner address root causes such as poor sizing labels, misleading photography, or a specific supplier's quality issues. The `reason` field stored on `Return` records is the primary data source for the causal breakdown.

---

## Instructions

**Step 1: Create the page file**

Create `src/app/(dashboard)/[tenantSlug]/reports/returns/page.tsx` as a Server Component. Extract `tenantSlug`, `from`, and `to` from props. Resolve `tenantId`. Run all queries in parallel using `Promise.all`.

**Step 2: Query overall revenue and return totals**

Query `prisma.sale.aggregate` filtering `tenantId`, `status: "COMPLETED"`, and the date range for `_sum: { totalAmount: true }`. Query `prisma.return.aggregate` with the same date range for `_sum: { refundAmount: true }` and `_count: { id: true }`. Overall Return Rate % is `(totalRefunds / totalRevenue) * 100` computed with `decimal.js`, formatted to two decimal places.

**Step 3: Query category-level return rates**

This requires two grouped aggregations. First, use `prisma.$queryRaw` to produce per-category sales revenue: join `Sale` → `SaleLine` → `ProductVariant` → `Product` → `Category`, grouping by `Category.id` and `Category.name`, summing `SaleLine.lineTotal`. Filter by `Sale.tenantId`, `Sale.status = 'COMPLETED'`, and `Sale.createdAt` in range.

Second, run a parallel `prisma.$queryRaw` for per-category return values: join `Return` → `ReturnLine` → `ProductVariant` → `Product` → `Category`, grouping by `Category.id` and `Category.name`, summing `ReturnLine.refundAmount`. Filter by `Return.tenantId`, `Return.status = 'COMPLETED'`, and `Return.createdAt` in range.

Merge the two results by `categoryId` in JavaScript. For each category, compute Return Rate % as `(categoryReturns / categorySales) * 100`. Sort by return rate descending.

**Step 4: Build the category return rate table**

Render a ShadCN `Table` with columns:

| Column                | Description                                                         |
|-----------------------|---------------------------------------------------------------------|
| Category              | Category name                                                       |
| Total Sales Revenue   | Sum of `lineTotal` for completed sales in range — `font-mono`      |
| Total Returns Value   | Sum of `refundAmount` for returns in range — `font-mono`, red text |
| Return Rate %         | Computed percentage — right-aligned, colour-coded (see Step 5)     |

**Step 5: Colour-code the Return Rate % column**

Apply a `getReturnRateColour` helper:
- Below 3 %: green text (healthy).
- 3 % to 7 %: amber text (monitor).
- Above 7 %: red text and bold (action required).

**Step 6: Query return reasons**

Use `prisma.return.groupBy` with `by: ["reason"]`, filtering `tenantId`, `status: "COMPLETED"`, and the date range. Select `_count: { id: true }` and `_sum: { refundAmount: true }`. Null/empty reasons should be bucketed under the label "No Reason Given" in the display (map `null` to `"No Reason Given"` in JavaScript after the query).

**Step 7: Build the return reasons donut chart**

Create a `ReturnReasonsChart` client component. Use `Recharts PieChart` with `innerRadius={60}` and `outerRadius={120}` to produce a donut shape. The `data` array comes from the reason groupBy result. Each slice `fill` is drawn from a fixed palette cycling: terracotta `#A48374`, sand `#CBAD8D`, mist `#D1C7BD`, espresso `#3A2D28`, linen `#EBE3DB`, pearl `#F1EDE6`. Add a `Tooltip` showing the reason label, count, and total refund value. Add a `Legend` below the chart.

In the centre of the donut (using an absolute-positioned overlay in a `relative` wrapper div), display the total number of return transactions and the label "Returns" in a small two-line summary.

**Step 8: Query top 10 most-returned products**

Use `prisma.$queryRaw` to join `ReturnLine` → `ProductVariant` → `Product`, grouping by `Product.id` and `Product.name`, summing `ReturnLine.quantity` as `returnedUnits` and `ReturnLine.refundAmount` as `returnValue`. Filter by `Return.tenantId`, `Return.status = 'COMPLETED'`, and `Return.createdAt` in range. Order by `returnedUnits` descending and limit to 10.

**Step 9: Build the top 10 most-returned products table**

Render a ShadCN `Table` with columns: Rank, Product Name, Total Units Returned, Total Return Value in `font-mono`. Include a brief note below the table: "Products with high return counts may indicate sizing, quality, or description issues." Style the rank column with the espresso background for rank 1–3 (podium effect).

**Step 10: Compose the page layout**

Arrange the sections vertically: an overall stats banner (Overall Return Rate %, total returns count, total refund value) as three stat cards — then the category return rate table under a "Returns by Category" Playfair Display heading — then a two-column layout with the donut chart on the left and a small reasons summary list on the right — then the top 10 most-returned products table.

**Step 11: Connect ReportContext**

Flatten the category table rows and call `setReportData` with them. The donut chart data and top 10 rows are separately accessible in the export via a custom export button provided to `ReportLayout`.

---

## Expected Output

- Return Rate report loads with overall stats, category table, reasons donut, and top-10 table.
- Category return rates are colour-coded green/amber/red.
- Reasons donut chart renders with correct slice proportions.
- Top 10 most-returned products are ranked by units returned.

---

## Validation

- [ ] Overall Return Rate % equals the result of total refunds divided by total sales revenue for the period.
- [ ] A category with zero returns shows a Return Rate % of 0.00 % in green.
- [ ] A category with Return Rate > 7 % shows in red bold.
- [ ] Null `reason` values are grouped under "No Reason Given" in the donut chart.
- [ ] The donut chart slices sum to 100 % (all returns are accounted for).
- [ ] The top 10 table uses units returned (quantity), not refund value, for ranking.
- [ ] The page loads without errors when there are zero returns in the selected period.
- [ ] `$queryRaw` calls for category-level data use parameterised inputs.
