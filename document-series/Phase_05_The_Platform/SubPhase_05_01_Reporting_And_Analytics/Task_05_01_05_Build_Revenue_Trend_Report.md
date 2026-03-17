# Task 05.01.05 — Build Revenue Trend Report

## Metadata

| Field        | Value                                                   |
|--------------|---------------------------------------------------------|
| SubPhase     | 05.01 — Reporting and Analytics                         |
| Phase        | 05 — The Platform                                       |
| Complexity   | Moderate                                                |
| Dependencies | 05.01.02 (ReportLayout), Sale, Return models exist      |

---

## Objective

Build the Revenue Trend report at `/dashboard/[tenantSlug]/reports/revenue-trend`, displaying a time-series line chart of daily, weekly, or monthly revenue with an overlaid returns line, four key stat cards, and a peak-hour bar chart.

---

## Context

A trend view over time reveals seasonality, the impact of promotions, and unusual drops or spikes that a point-in-time P&L cannot surface. Toggling between daily, weekly, and monthly granularity lets a cashier look at this week versus a manager examining quarterly trends with the same interface. The peak-hour chart helps the owner decide staffing patterns.

---

## Instructions

**Step 1: Create the page file**

Create `src/app/(dashboard)/[tenantSlug]/reports/revenue-trend/page.tsx` as a Server Component. Extract `tenantSlug`, `from`, `to`, and an optional `granularity` search param (defaulting to `"daily"`) from props. Resolve `tenantId` from the tenant slug.

**Step 2: Query time-series revenue data**

Use `prisma.$queryRaw` to perform a date-bucket aggregation. The SQL selects `DATE_TRUNC('day', "createdAt")` as `bucket` (or `'week'` / `'month'` based on the `granularity` param), `SUM("totalAmount")` as `revenue`, and `COUNT(id)` as `transactions` from the `Sale` table where `tenantId` equals the tenant id, `status` is `'COMPLETED'`, and `createdAt` is between the from and to dates. Group by `bucket` and order by `bucket` ascending.

Run a parallel `prisma.$queryRaw` for returns: select the same date bucket from `Return` where `tenantId` equals the tenant, `status` is `'COMPLETED'`, and sum the `refundAmount` column. Group and order by bucket.

Merge the two result sets in JavaScript by matching bucket timestamps. For any revenue bucket with no corresponding return bucket, set the returns value to zero.

**Step 3: Compute the four key stat cards**

Using the merged dataset and `decimal.js`, compute:
- **Total Revenue**: sum of all revenue buckets in the period.
- **Total Transactions**: sum of all transaction counts.
- **Average Order Value**: Total Revenue divided by Total Transactions, formatted to two decimal places.
- **Return Rate %**: total returns value divided by total revenue, multiplied by 100, formatted to one decimal place.

Pass these four values as serialised strings to a `StatCards` client component that renders four ShadCN `Card` components in a 2×2 grid (4-column on desktop).

**Step 4: Build the revenue trend line chart**

Create a `RevenueTrendChart` client component. Render a `Recharts ResponsiveContainer` with a `LineChart` component. The chart needs two `Line` elements:
- Revenue line: `dataKey="revenue"`, stroke terracotta `#A48374`, strokeWidth 2, with dot disabled for dense daily views.
- Returns line: `dataKey="returns"`, stroke mist `#D1C7BD`, strokeWidth 1.5, strokeDasharray "4 4" for a dashed appearance distinguishing it from the revenue line.

The X-axis uses the bucket date formatted as `"dd MMM"` for daily, `"d MMM"` for weekly (week start), or `"MMM yyyy"` for monthly. The Y-axis formats values with a "LKR" prefix and uses abbreviated notation (e.g., "LKR 50K") via a custom tick formatter. Add a `Tooltip` showing both values for the hovered date. Add a `Legend` below the chart labelling the two lines "Gross Revenue" and "Returns".

**Step 5: Build the granularity toggle**

Add three toggle buttons above the chart — "Daily", "Weekly", "Monthly" — as a ShadCN `ToggleGroup`. Selecting a toggle updates the `?granularity=` URL param via `router.push`, which causes the Server Component to re-run the query with the new truncation unit. Highlight the active granularity in espresso `#3A2D28`.

**Step 6: Query peak-hour data**

Use `prisma.$queryRaw` to extract the hour-of-day from `Sale.createdAt` using `EXTRACT(HOUR FROM "createdAt")` as `hour`, with `SUM("totalAmount")` as `revenue` and `COUNT(id)` as `transactions`. Filter by the same `tenantId`, `status`, and date range. Group by `hour` and order by `hour` ascending. This produces an array of 24 buckets (hours 0–23).

**Step 7: Build the peak-hour bar chart**

Create a `PeakHoursChart` client component rendering a `Recharts BarChart` with the 24-hour dataset. The X-axis labels each bar with the hour formatted as `"ha"` (e.g., "9am", "2pm"). The Y-axis shows transaction count. The bar fill uses a computed opacity: full terracotta `#A48374` for the peak hour (max transactions), fading to sand `#CBAD8D` for off-peak hours, achieved with a custom `Cell` component per bar comparing each bar's value to the maximum. Add a `Tooltip` showing both revenue and transaction count for the hovered hour.

**Step 8: Compose the page layout**

The main page renders in this vertical order: the four stat cards, the granularity toggle and revenue trend line chart (with a section heading "Revenue Over Time" in Playfair Display), then the peak-hour bar chart (with heading "Peak Trading Hours"). Both charts sit inside ShadCN `Card` wrappers with the pearl background.

**Step 9: Connect ReportContext**

Call `setReportData` with the flat time-series array (one row per date bucket, columns: Date, Revenue, Returns, Transactions) for export compatibility.

---

## Expected Output

- Revenue Trend page shows four stat cards and two charts.
- Toggling Daily/Weekly/Monthly re-queries and re-renders the line chart with the correct bucket granularity.
- Returns line appears as a dashed line below the revenue line.
- Peak-hour chart highlights the busiest hour with full colour saturation.
- Changing the date range in `ReportLayout` refreshes all figures.

---

## Validation

- [ ] Daily granularity produces exactly as many data points as there are days in the selected range.
- [ ] Weekly granularity truncates to Monday of each week with no duplicate buckets.
- [ ] Total Revenue on the stat card matches the sum of bucket revenues (verify with P&L report figure).
- [ ] Return Rate % is zero when there are no returns in the period (not NaN or Infinity).
- [ ] The peak-hour chart renders 24 bars with hour labels from 0 to 23.
- [ ] The peak hour bar is visually darker than all other bars.
- [ ] The line chart renders correctly with a single data point (one day selected range).
- [ ] `$queryRaw` calls use parameterised `tenantId` and date inputs, not string interpolation.
