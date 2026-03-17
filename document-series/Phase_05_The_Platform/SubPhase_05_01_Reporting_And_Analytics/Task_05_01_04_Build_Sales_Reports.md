# Task 05.01.04 — Build Sales Reports

## Metadata

| Field        | Value                                                          |
|--------------|----------------------------------------------------------------|
| SubPhase     | 05.01 — Reporting and Analytics                                |
| Phase        | 05 — The Platform                                             |
| Complexity   | Moderate                                                       |
| Dependencies | 05.01.02 (ReportLayout), Sale, SaleLine, User, Product, ProductVariant, CommissionRecord models |

---

## Objective

Build two sales analysis report pages — Sales by Product at `/reports/sales-by-product` and Sales by Staff at `/reports/sales-by-staff` — each presenting a sortable table and a Recharts bar chart of the top ten items.

---

## Context

Sales attribution at both the product and staff level is critical for a boutique: owners need to know which SKUs are generating revenue and which staff members are performing. Both reports share the same date-range filter from the `ReportLayout` shell and follow an identical structural pattern — server-side data aggregation, a sortable table, and a top-10 chart.

---

## Instructions

**Step 1: Create the Sales by Product page**

Create `src/app/(dashboard)/[tenantSlug]/reports/sales-by-product/page.tsx` as a Server Component. Extract `tenantSlug`, `from`, and `to` from props and resolve `tenantId` via Prisma. Default the date range to the last 30 days if params are absent.

**Step 2: Query product-level sales data**

Use `prisma.saleLine.groupBy` with `by: ["productVariantId"]`, filtering via a nested `sale` relation where `sale.tenantId` equals the tenant, `sale.status` is `"COMPLETED"`, and `sale.createdAt` is between `from` and `to`. Select `_sum: { lineTotal: true, quantity: true }` and `_count: { id: true }`.

To obtain product and variant names, follow up with a `prisma.productVariant.findMany` call using an `in` filter on the collected `productVariantId` values, including the `product` relation for the product name. Join the two result sets in JavaScript by matching `productVariantId`.

For returns, run `prisma.returnLine.groupBy` with the same date range filter via the nested `return` relation, grouping by `productVariantId`, selecting `_sum: { refundAmount: true }`. Subtract the refund amount from `lineTotal` to produce "Net Revenue" per product.

**Step 3: Compute totals and percentage share**

After joining product details and return data, compute the grand total net revenue across all rows using `decimal.js`. For each row, compute "% of Total" as `(rowNetRevenue / totalNetRevenue) * 100` and format to one decimal place. Sort the final array by `netRevenue` descending for the default table view.

**Step 4: Build the Sales by Product table**

Render a ShadCN `Table` component with the following columns:

| Column        | Description                                               |
|---------------|-----------------------------------------------------------|
| Product       | Product name                                              |
| Variant       | Variant label (size, colour)                              |
| Units Sold    | Sum of `quantity` — integer, right-aligned                |
| Gross Revenue | Sum of `lineTotal` — `font-mono`, right-aligned           |
| Returns       | Sum of refund amounts — `font-mono`, red text, right-aligned |
| Net Revenue   | Gross minus Returns — `font-mono`, bold, right-aligned    |
| % of Total    | Percentage share — right-aligned, muted colour            |

Include a footer row with grand-total values for numeric columns. The table header supports click-to-sort on "Units Sold", "Gross Revenue", and "Net Revenue" columns using a `useState` sort state in a client wrapper component.

**Step 5: Build the top-10 bar chart for Sales by Product**

Slice the first 10 entries from the sorted array. Pass these to a `TopProductsChart` client component. Render a `Recharts ResponsiveContainer` wrapping a `BarChart` with `layout="vertical"` so product names appear on the Y-axis. The X-axis shows net revenue. Use terracotta `#A48374` fill for bars. Add a `Tooltip` showing "Net Revenue: LKR X,XXX.XX" and a `Legend`. Label the bar chart heading "Top 10 Products by Net Revenue".

**Step 6: Create the Sales by Staff page**

Create `src/app/(dashboard)/[tenantSlug]/reports/sales-by-staff/page.tsx` as a Server Component following the same structural pattern.

**Step 7: Query staff-level sales data**

Use `prisma.sale.groupBy` with `by: ["cashierId"]`, filtering by `tenantId`, `status: "COMPLETED"`, and the date range. Select `_sum: { totalAmount: true }` and `_count: { id: true }`. Fetch the matching `User` records for each `cashierId` to get name and role. Compute "Average Transaction Value" per staff member as `totalAmount / transactionCount` using `decimal.js`.

To get commission data, call `prisma.commissionRecord.groupBy` with `by: ["userId"]`, `_sum: { commissionAmount: true }`, filtering by the same date range and `tenantId`.

**Step 8: Build the Sales by Staff table**

Render a table with columns:

| Column                   | Description                                        |
|--------------------------|----------------------------------------------------|
| Staff Name               | User's full name                                   |
| Role                     | CASHIER / MANAGER badge                            |
| Transactions             | Count of completed sales — integer, right-aligned  |
| Total Revenue            | `_sum.totalAmount` — `font-mono`, right-aligned    |
| Avg Transaction Value    | `totalAmount / count` — `font-mono`, right-aligned |
| Commission Earned        | Commission sum — `font-mono`, right-aligned        |

Include a totals footer row. The table should be sortable on "Total Revenue" and "Transactions" columns.

**Step 9: Build the top-10 bar chart for Sales by Staff**

Pass the sorted staff array to a `TopStaffChart` client component using the same `BarChart layout="vertical"` pattern. Use sand `#CBAD8D` fill for a visual distinction from the Products chart. Label it "Revenue by Staff Member".

**Step 10: Connect ReportContext on both pages**

Each page calls `setReportData` with its formatted flat-row array so the `ReportLayout` export controls have data to export. For Sales by Product, the flat row shape includes all seven columns as string-serialised values. For Sales by Staff, include all six columns.

---

## Expected Output

- `/reports/sales-by-product` loads a sorted table of product revenue with a top-10 chart.
- `/reports/sales-by-staff` loads a table of staff performance with a top-10 chart.
- Both tables have sortable columns and a grand-total footer row.
- Changing the date range re-runs the server queries and refreshes the tables.
- The export mechanism has access to the current table data via `ReportContext`.

---

## Validation

- [ ] Net Revenue per product = Gross Revenue minus Returns — verify with a known sale/return pair.
- [ ] "% of Total" values across all product rows sum to 100 %.
- [ ] The bar charts render the top 10 items and are labelled correctly.
- [ ] Staff table returns only users whose `cashierId` appears in the selected date range (zero-sale staff are excluded).
- [ ] Commission Earned column shows `LKR 0.00` for staff with no commission records (not blank or null).
- [ ] Sort toggle on "Net Revenue" header reverses the row order correctly.
- [ ] Both pages load without errors when the date range contains zero sales.
