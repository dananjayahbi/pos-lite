# Task 02.03.06 — Build Low Stock Alert Widget

## Metadata

| Field | Value |
|---|---|
| Task ID | 02.03.06 |
| Task Name | Build Low Stock Alert Widget |
| Parent Sub-Phase | SubPhase_02_03 — Advanced Stock Control |
| Complexity | Low |
| Dependencies | Task_02_03_01 complete |
| Output Paths | src/components/stock/LowStockAlertBadge.tsx, src/app/dashboard/[tenantSlug]/stock-control/low-stock/page.tsx |

---

## Objective

Build the Low Stock Alert widget as a reusable component and create the full low-stock list page it links to. The widget will appear in multiple locations across the dashboard — on the Stock Control landing page, in the Inventory List page header, and in the main dashboard header — giving staff persistent visibility into inventory health. The full list page provides a sortable, filterable, and exportable view of all variants currently at or below their individual low stock thresholds.

---

## Instructions

### Step 1: Build the LowStockAlertBadge Component

Create src/components/stock/LowStockAlertBadge.tsx as a client component. The component accepts two props: a tenantSlug string to construct the correct navigation URL, and an optional initialCount number for server-pass-down hydration.

Internally, the component uses a TanStack Query hook useGetLowStockVariants to fetch the current low stock count. The query calls GET /api/stock/low-stock?countOnly=true, which returns a single integer rather than a full paginated list. Set the stale time to 60 seconds — low stock counts do not need to be real-time to the second.

The component renders nothing when the count is zero. When count is greater than zero, render a compact clickable banner styled with the warning semantic colour. The banner contains a warning triangle icon on the left, the text "X variants low on stock" in the warning amber colour using Inter medium weight, and a right-pointing arrow on the right. The entire banner is a Next.js Link element navigating to /dashboard/[tenantSlug]/stock-control/low-stock.

On hover, the banner background deepens slightly toward a richer amber tone, following the terracotta hover convention adapted to the warning colour family.

While the query is in a loading state, render a skeleton placeholder matching the banner's approximate dimensions using ShadCN Skeleton.

### Step 2: Register the Widget in Three Locations

The LowStockAlertBadge component must be integrated into three existing layout or page components:

In the Stock Control landing page (Task_02_03_01), place the widget between the KPI card grid and the navigation grid. This location was already called out in Task_02_03_01; confirm it is wired to the actual component rather than a hardcoded UI stub.

In the Inventory List page (from SubPhase_02_02), place the widget in the page header area immediately below the page title. Import the component and pass the tenantSlug. Confirm this does not interfere with existing inventory list filters.

In the main dashboard sidebar or top navigation bar header (from Phase 01 layout), place the widget compactly — in this context, use only the count number rendered as a small circular badge on a warning amber background without the full banner text. Clicking it navigates to the low-stock list page as normal.

### Step 3: Create the Low Stock List Page Route

Create src/app/dashboard/[tenantSlug]/stock-control/low-stock/page.tsx. This page requires the stock:view permission — apply the standard inline permission-denied card guard.

Apply linen page background. Include breadcrumb: Dashboard → Stock Control → Low Stock.

### Step 4: Build the Low Stock Page Header

Render an H1 in Playfair Display: "Low Stock Variants". Inline with the heading, render a warning-coloured badge showing the total count. Below the heading, render an Inter subtitle: "Variants currently at or below their configured low stock threshold."

At the top right of the heading row, place an "Export Low Stock List" button (secondary outline style with download icon). This triggers a CSV download described in Step 7.

### Step 5: Build the Threshold Filter

Below the heading, render a compact filter row in a pearl card. The only filter on this page is a threshold slider or number input labelled "Show variants with stock at or below:". The default value is the variant's own lowStockThreshold (i.e. showing all variants where stockQuantity ≤ their respective threshold). The user can optionally override this to see e.g. all variants with stock at or below 10 units, regardless of their individual threshold setting.

Adding an "All variants below own threshold" default toggle beside the input resets the filter back to the per-variant threshold comparison. When the custom threshold override is active, render a small note: "Overriding individual thresholds — showing variants with stock ≤ {N}." When using per-variant thresholds, no note is shown.

### Step 6: Build the Low Stock Table

Render a ShadCN Table with sand-coloured header row. Default sort order is by shortfall descending (most urgent variants first). Shortfall is defined as lowStockThreshold minus stockQuantity — the larger the shortfall, the more urgent the restock need.

Columns:

The "Product" column shows the parent product name. Below the product name in smaller muted text, show the category name.

The "Category" column may be omitted on mobile viewports to maintain readability.

The "Variant" column shows the SKU in JetBrains Mono followed by size and colour in regular Inter text.

The "Current Stock" column shows the stockQuantity. Apply danger-red badge styling if the value is zero ("Out of Stock" label added). Apply warning-amber badge styling if the value is greater than zero but at or below the threshold. The badge makes the severity immediately apparent.

The "Threshold" column shows the variant's lowStockThreshold value in regular muted text.

The "Shortfall" column shows threshold minus current stock, formatted as "-X" in danger red if the shortfall is greater than zero. If stock is exactly at threshold (shortfall zero), show "At threshold" in warning amber.

The "Retail Price" column shows the retailPrice in the Rs. format using JetBrains Mono for the numeric portion.

The "Actions" column contains a single "Adjust Stock" button for each row, styled as a small outlined primary action button. Clicking this button navigates to the Manual Adjustment form at /stock-control/adjust with the variantId passed as a query parameter, pre-selecting that specific variant so the user does not need to search for it.

### Step 7: Implement the CSV Export

The "Export Low Stock List" button at the top right calls GET /api/stock/low-stock?format=csv with the currently active threshold filter applied. The server returns a text/csv response triggering a browser download. The CSV file is named "low-stock-{date}.csv" where date is the current date formatted as YYYY-MM-DD.

CSV columns: Product Name, Category, SKU, Size, Colour, Current Stock, Threshold, Shortfall, Retail Price. All values use plain text — no currency symbols in the retail price column for easier spreadsheet manipulation.

### Step 8: Handle the Empty State

If no variants are currently below their threshold — meaning the store is fully stocked — render a success-coloured empty state inside the table area. Content: a check mark icon in success green, the bold text "All variants are adequately stocked", and a secondary note "No variants are currently at or below their low stock threshold."

This empty state should feel celebratory rather than neutral, since a fully stocked catalog is a positive outcome worth acknowledging clearly.

---

## Expected Output

A working LowStockAlertBadge reusable component integrated in three dashboard locations, and a full low stock list page at /dashboard/[tenantSlug]/stock-control/low-stock. The badge shows the live low-stock variant count, the list page shows the prioritised table of at-risk variants with a direct shortcut to adjust each one, and the CSV export works correctly.

---

## Validation

- Verify the LowStockAlertBadge is visible on the Stock Control page, the Inventory List page, and the main dashboard header when low stock variants exist in the seed data.
- Navigate to /dashboard/dev-store/stock-control/low-stock. Confirm the table shows variants that the seed explicitly set below their thresholds.
- Verify the default sort order is correct (highest shortfall first).
- Click "Adjust Stock" on a low-stock row. Confirm the Manual Adjustment form opens with the correct variant pre-selected.
- Export the low stock list and verify the downloaded CSV contains the correct data.
- Modify a variant's stock to exactly its threshold value. Confirm it appears in the list (at-threshold variants are included).
- Modify a variant's stock to one above its threshold. Confirm it disappears from the list.

---

## Notes

- The countOnly=true API optimisation is important for the badge component. Do not fetch the full list just to display a count — this would be unnecessarily expensive when the badge is mounted in multiple layout components that all render on every navigation.
- The "Adjust Stock" link pre-fills the variantId query parameter on the adjustment form. Task_02_03_02 must handle this parameter: on mount, if a variantId query parameter is present, skip the product lookup step and directly select that variant.
- If a variant's lowStockThreshold is zero (meaning no threshold is configured), it should not appear in the low stock list even if its stock is also zero — out-of-stock with no threshold set is not a "low stock alert" condition, it is a separate state managed differently.
