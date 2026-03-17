# Task 02.03.03 — Build Stock Movement History

## Metadata

| Field | Value |
|---|---|
| Task ID | 02.03.03 |
| Task Name | Build Stock Movement History |
| Parent Sub-Phase | SubPhase_02_03 — Advanced Stock Control |
| Complexity | Medium |
| Dependencies | Task_02_03_01 complete |
| Output Path | src/app/dashboard/[tenantSlug]/stock-control/movements/page.tsx |

---

## Objective

Build the Stock Movement History page at /dashboard/[tenantSlug]/stock-control/movements. This page is the primary audit trail view for all inventory changes within a tenant. Every manual adjustment, stock take correction, sale return, and initial stock entry appears here in a filterable, paginated, exportable table. The page must support a multi-dimensional filter bar and present each movement record in a clear, scannable format for store managers investigating inventory discrepancies.

---

## Instructions

### Step 1: Create the Route and Apply Permission Guard

Create the page file at src/app/dashboard/[tenantSlug]/stock-control/movements/page.tsx. Gate the entire page on the stock:view permission. Users without this permission see a permission-denied card rather than a redirect.

Apply the standard linen background to the page content area. The espresso sidebar marks "Stock Control" as the active section. Include a breadcrumb above the main content: Dashboard → Stock Control → Movement History.

### Step 2: Render the Page Header and Export Button

Render an H1 heading in Playfair Display: "Stock Movement History". On the same horizontal row to the right of the heading, render an "Export CSV" button styled as a secondary outline button with a download icon. This button triggers the CSV export described in Step 9. Below the heading, render a muted subtitle in Inter: "A complete audit trail of all stock changes across your catalog."

### Step 3: Build the Filter Bar

The filter bar sits in a pearl card with a sand border directly below the page header. It contains four filter controls laid out in a responsive two-column grid on desktop (full width on mobile):

The first filter is a "Date Range" picker composed of two ShadCN Popover-based date picker fields side by side: "From" and "To". The default range on page load is the last 30 days, computed from the current date. Clear buttons (×) appear inside each date field once a date is selected, allowing the user to widen the range back to the default.

The second filter is a "Reason" multi-select chip group. All nine StockMovementReason enum values are displayed as toggleable chips. By default, all reasons are selected (no filtering). When the user deactivates one or more reasons, the query narrows to only the selected ones. Each chip uses a small colour indicator dot matching the badge colour used in the table.

The third filter is a "Product or SKU" text input that accepts free text. The query filters movement records whose associated variant SKU or parent product name contains the entered text (case-insensitive). Debounce this input at 300 milliseconds to avoid firing on every keystroke.

The fourth filter is an "Actor" dropdown. This is a ShadCN Select populated with all staff users who appear as actors in the StockMovement records for the tenant. The dropdown includes an "All Staff" default option. Selecting a specific user narrows movements to those made by that actor.

Below the four filter fields, add a small "Clear All Filters" text link in terracotta colour that resets all filters to their defaults and reloads the default date range.

All filter state is written to and read from URL search parameters so that filtered views are bookmarkable and shareable.

### Step 4: Display the Active Filter Summary

When any non-default filter is active, render a row of dismissable filter pill badges below the filter bar. Each active filter is represented as a pill showing its label and current value alongside an × button to remove just that filter. Examples: a date range pill shows "Jan 15 – Feb 14", a reason pill shows "Reason: Damaged", an actor pill shows "Actor: Priya S." This gives the user clear visibility into what is currently being filtered without requiring them to read through each input.

### Step 5: Build the Movement History Table

Render a ShadCN Table component inside a pearl card. The table header row uses sand background. Column definitions are as follows:

The "Date & Time" column shows the createdAt timestamp formatted as "15 Jan 2025, 2:34 PM" in Inter. This column is sortable — clicking the column header toggles between newest-first and oldest-first sort order.

The "Product" column shows the parent product name as a clickable link (in terracotta colour) that navigates to the product detail page. Below the product name in small muted text, show the category name.

The "Variant" column shows the variant's SKU in JetBrains Mono font class followed by a forward slash and the size and colour combination in regular Inter text. Example: "VLV-001-M-BLK / M / Black".

The "Reason" column shows a coloured badge using the reason enum value. The badge colour mapping is: FOUND uses success green; INITIAL_STOCK uses success green; PURCHASE_RECEIVED uses success green; DAMAGED uses danger red; STOLEN uses danger red; DATA_ERROR uses info blue; STOCK_TAKE_ADJUSTMENT uses info blue; RETURNED_TO_SUPPLIER uses warning amber; SALE_RETURN uses warning amber. The badge label uses the human-readable label from the enum mapping table defined in Task_02_03_02.

The "Change" column is the quantityDelta value formatted with an explicit sign. Positive deltas render as "+12" in bold success green. Negative deltas render as "-3" in bold danger red. Zero (which is theoretically impossible but defensively handled) renders as "0" in muted text.

The "Before" column shows the quantityBefore value in muted mist-coloured text, indicating the historic stock level before the movement.

The "After" column shows the quantityAfter value in bold text, coloured using stock level semantics: danger if zero, warning if at or below threshold, success otherwise.

The "Actor" column shows the full display name of the user who made the adjustment in regular Inter text.

The "Note" column shows the note text content. If the note exceeds 60 characters, truncate it with an ellipsis and display the full text in a ShadCN Tooltip triggered on hover. If no note was provided, render a muted dash character.

### Step 6: Implement URL-Driven Pagination

The table displays 25 movement records per page. Pagination controls sit below the table showing "Showing X–Y of Z movements" text on the left and previous/next navigation buttons on the right. The page number is stored as a query parameter (page=2) in the URL, enabling bookmarking and browser back/forward navigation. Include a direct page number input for administrators who need to jump far into a large history.

When the total result count changes due to filter application, reset to page 1 automatically.

### Step 7: Implement Loading and Empty States

During data fetching, replace the table body rows with ShadCN Skeleton placeholder rows matching the table's column structure. Render seven skeleton rows to approximate a visible page of data. The skeleton rows pulse with the standard animation.

When the query returns zero results for the current filter combination, display an empty state inline within the table's body area rather than collapsing the table entirely. The empty state shows a muted inventory icon, the text "No stock movements found for the selected filters", and a suggested action: "Try extending the date range or clearing the reason filter" as a clickable action that resets those specific filters.

### Step 8: Connect Filters to TanStack Query

Create a custom hook useGetStockMovements in src/hooks/useGetStockMovements.ts. The hook accepts a filter parameters object and constructs the query string for GET /api/stock/movements. Use TanStack Query's useQuery with a query key that includes all active filter values so that every distinct filter combination has its own cache entry. Set the stale time to 30 seconds so that navigating back to a recently viewed filter result does not trigger unnecessary refetches.

The hook should return the paginated movement records, the total count, and the loading/error states. Handle error states by rendering a ShadCN Alert component inside the table card with the error message and a retry button.

### Step 9: Implement CSV Export

The "Export CSV" button at the top right of the page triggers a download of the currently filtered movement history. The CSV export calls GET /api/stock/movements with the same active filter parameters plus a format=csv query parameter appended. The API route detects this parameter and returns a text/csv response with the content disposition header set to trigger a browser download.

The CSV file is named "stock-movements-{fromDate}-to-{toDate}.csv" using the active date range. If no date range is active, the filename uses "stock-movements-all.csv". Columns in the CSV match the table columns but include the full note text (not truncated) and the raw enum value for the reason column alongside the human-readable label for easy filtering in spreadsheet tools.

While the export request is in flight, the Export CSV button shows a spinner and the label "Exporting…" and is disabled to prevent duplicate requests.

---

## Expected Output

A fully functional, filterable, paginated Stock Movement History page at /dashboard/[tenantSlug]/stock-control/movements. All filter controls update the table results in real time. The URL reflects the active filter state. The CSV export correctly downloads the filtered result set. Loading and empty states are handled gracefully.

---

## Validation

- Navigate to /dashboard/dev-store/stock-control/movements. Confirm the table loads with seeded movement records and defaults to the last 30 days.
- Apply the date range filter to a period in the future. Confirm the empty state is shown.
- Select only the "Damaged" reason chip. Confirm only DAMAGED movements appear in the table.
- Apply the "Actor" filter to a specific seed user. Confirm only that user's movements appear.
- Click "Export CSV" with a reason filter active. Confirm the downloaded file only contains records matching that reason.
- Verify that SKU values in the Variant column render in JetBrains Mono font.
- Confirm that a movement with a long note shows truncated text in the table cell and the full text on hover.

---

## Notes

- The movements query can return large result sets on a mature store catalog. The API should enforce a maximum limit of 100 records per request even if the client requests more, and the client should always use pagination rather than fetching all records at once.
- The Actor dropdown is populated dynamically from the actorIds present in the movement records. This ensures only relevant staff appear in the filter rather than all users in the tenant.
- URL-driven filter state is essential for supporting manager workflows where a filtered view is shared with a team member via a copied URL.
