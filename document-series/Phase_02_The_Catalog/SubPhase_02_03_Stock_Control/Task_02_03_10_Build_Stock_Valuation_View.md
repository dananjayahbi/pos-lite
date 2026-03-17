# Task 02.03.10 — Build Stock Valuation View

## Metadata

| Field | Value |
|---|---|
| Task ID | 02.03.10 |
| Task Name | Build Stock Valuation View |
| Parent Sub-Phase | SubPhase_02_03 — Advanced Stock Control |
| Complexity | Medium |
| Dependencies | Task_02_03_01 complete |
| Output Path | src/app/dashboard/[tenantSlug]/stock-control/valuation/page.tsx |

---

## Objective

Build the Stock Valuation page at /dashboard/[tenantSlug]/stock-control/valuation. This page presents a financial summary of the store's current inventory value: retail value (what the stock could sell for), cost value (what the store paid for it), estimated margin, and a per-category breakdown helping managers understand where their capital is concentrated. Access is restricted to users with the product:view_cost_price permission since cost pricing is commercially sensitive data.

---

## Instructions

### Step 1: Create the Route and Permission Check

Create src/app/dashboard/[tenantSlug]/stock-control/valuation/page.tsx. Check whether the authenticated user holds the product:view_cost_price permission.

If the user lacks this permission, do not redirect. Instead, render an inline permission-denied card: a pearl card with a lock icon, the heading "Access Restricted" in Playfair Display H2, and the body text "Stock valuation data includes cost prices, which are restricted to store owners and authorized managers. Contact your store owner to request access." Include a back link to Stock Control. This approach prevents navigation confusion and is consistent with permission handling across the sub-phase.

### Step 2: Render the Page Header

For authorised users, render the full page with linen background. Include a breadcrumb at the top: Dashboard → Stock Control → Stock Valuation.

Render an H1 in Playfair Display: "Stock Valuation". Below the heading, render a subtitle in Inter muted text: "As of [date and time]" where the date and time are taken from the calculatedAt timestamp returned by the valuation API. Since the valuation is computed live on each page load, this timestamp will always be close to the current time. Format the timestamp as "17 Mar 2026, 10:42 AM".

On the same row as the heading, place two action buttons at the right edge: a "Refresh" secondary outlined button with a rotate/refresh icon, and an "Export Valuation Report" secondary outlined button with a download icon.

### Step 3: Fetch the Valuation Data

Use TanStack Query with a useGetStockValuation hook calling GET /api/stock/valuation. Because the valuation is computed synchronously and can be slow on large catalogs, set the stale time to 5 minutes — users should not expect real-time live prices, and repeated refreshes within a short window should serve from cache. The Refresh button performs an explicit query invalidation and refetch when clicked.

While the data is loading on first fetch, display skeleton placeholders for all four KPI cards and the category table. On error, display a ShadCN Alert component with the error message and the Refresh button.

### Step 4: Render the Four Summary KPI Cards

Arrange four cards in a responsive four-column grid (two columns on medium, one on small). Each card uses linen background with a sand border and Playfair Display for the primary value.

The first card is "Total Retail Value". Display the formatted rupee value as a large number in espresso colour. Below, render Inter subtext: "What your stock could sell for at retail prices."

The second card is "Total Cost Value". Display the formatted rupee amount. Below, render Inter subtext: "What your current stock cost to acquire." This card is always visible on this page since the entire page is gated on product:view_cost_price.

The third card is "Estimated Gross Margin". Display both the absolute margin in rupees and the percentage on two lines within the card. The primary number is the percentage formatted as "58.1%" in a large espresso heading. Below it, render the absolute value: "Rs. 2,340,000 in margin". Below both values, render subtext: "Based on retail minus cost value." Apply success green text to the percentage when it is above 30%, warning amber when between 10% and 30%, and danger red when below 10%.

The fourth card is "Variants in Stock". Display the count of variants with stockQuantity greater than zero. Below, render subtext: "Variants with at least one unit available."

### Step 5: Build the Category Breakdown Table

Below the KPI cards, add a section with heading "Category Breakdown" in Inter semibold. Below the heading, render a ShadCN Table with sand-coloured header row.

Columns:

The "Category" column shows the category name in regular Inter text. If a product has no category assigned, group it under "Uncategorised" at the bottom of the tabel.

The "Variants in Stock" column shows the count of variants with stock greater than zero for this category.

The "Retail Value" column shows the total retail value for the category (sum of stockQuantity × retailPrice for all variants in the category) formatted as a rupee value in JetBrains Mono.

The "Cost Value" column shows the total cost value (sum of stockQuantity × costPrice) in JetBrains Mono.

The "Margin %" column shows the gross margin percentage for the category, computed as (retailValue minus costValue) divided by retailValue, displayed as a percentage value with one decimal place. Apply the same colour coding as the summary card: green above 30%, warning between 10% and 30%, danger below 10%.

The "Share of Total" column shows what percentage of the store's total retail value this category represents. Render this as a percentage text value alongside a thin horizontal bar (using a CSS width relative to 100%) that visually fills in proportion to the share. For example, if a category holds 30% of total retail value, the bar fills 30% of the column width in a sand background with an espresso fill. This provides an at-a-glance sparkline-like visual.

Sort the table by retail value descending by default (most valuable category first). Allow the user to click column headers to re-sort by that column.

### Step 6: Implement the Export Functionality

The "Export Valuation Report" button at the top right calls GET /api/stock/valuation with a format=csv query parameter appended. The server returns a CSV file.

The CSV export contains two sections separated by a blank line. The first section is the summary header with four rows: Total Retail Value, Total Cost Value, Estimated Margin (Rs.), and Estimated Margin (%). The second section is the full category breakdown with columns: Category, Variants in Stock, Retail Value (Rs.), Cost Value (Rs.), Margin %, Share of Total.

The CSV filename is "stock-valuation-{YYYY-MM-DD}.csv".

While the export request is in flight, the Export button shows a spinner and the label "Exporting…" and is disabled.

### Step 7: Add the "Last Calculated At" Note and Refresh Behaviour

Because the valuation is computed on-demand rather than cached from a database snapshot, the page must be transparent that the numbers reflect the live state at the moment of the last fetch. The "As of" subtitle under the heading serves this purpose.

When the user clicks Refresh, invalidate the query, trigger a refetch, and show a small inline "Recalculating…" spinner next to the "As of" timestamp while the new data loads. Once new data is available, update the timestamp and the spinner disappears. This confirms to the user that the fresh data has been applied.

Show a small note below the summary cards in muted Inter small text: "Valuation is calculated live. Archived products and deleted variants are excluded." This manages expectations around the data scope.

---

## Expected Output

A permission-gated stock valuation page with four live KPI cards and a sortable category breakdown table. The page loads, displays, and refreshes valuation data correctly. The CSV export downloads a two-section report file. The page gracefully handles the permission-denied state for users lacking cost price visibility.

---

## Validation

- Log in as a STOCK_CLERK (no product:view_cost_price). Navigate to /dashboard/dev-store/stock-control/valuation. Confirm the permission-denied card renders correctly with the back link.
- Log in as a MANAGER. Navigate to the valuation page. Confirm the four KPI cards show non-zero values matching the seed data.
- Manually calculate the expected total retail value by summing stockQuantity × retailPrice across the seeded variants (using Prisma Studio or a direct query). Confirm the page value matches.
- Click the column header for "Cost Value" on the category table. Confirm the table re-sorts by cost value descending.
- Verify the "Share of Total" bar widths are proportional — if one category holds roughly half the retail value, its bar should be roughly 50% wide.
- Click "Export Valuation Report". Confirm the downloaded CSV has both the summary section and the category breakdown.
- Click "Refresh". Confirm the "Recalculating…" spinner appears briefly and the "As of" timestamp updates.

---

## Notes

- The valuation computation is a potentially expensive aggregation query for stores with hundreds of variants. For Phase 2, this is acceptable since physical stores rarely have more than a few thousand variants. A Phase 5 enhancement will introduce a daily cached valuation snapshot to avoid re-computing on every page load.
- The category breakdown must honour the same exclusion rules as the summary: archived products and deleted variants must be excluded. Verify the Prisma query uses the correct where clause to enforce this.
- Formatted rupee values on this page should use the shared formatRupee utility from src/lib/format.ts established in Task_02_03_01. All currency formatting must be consistent across the application.
- The margin percentage colour thresholds (30% / 10%) are sensible defaults for a clothing retail context in Sri Lanka. If the store owner needs to customise these thresholds in a future phase, they can be made configurable via tenant settings.
