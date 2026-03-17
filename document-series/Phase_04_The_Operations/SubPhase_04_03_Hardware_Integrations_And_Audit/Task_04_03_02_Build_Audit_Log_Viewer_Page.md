# Task 04.03.02 — Build Audit Log Viewer Page

## Metadata

| Field | Value |
|---|---|
| Task ID | 04.03.02 |
| Task Name | Build Audit Log Viewer Page |
| SubPhase | 04.03 — Hardware Integrations and Audit |
| Priority | High |
| Complexity | Medium |
| Estimated Effort | 2–3 hours |
| Depends On | 04.03.01 (audit.service.ts, GET /api/audit-logs) |
| Produces | /dashboard/[tenantSlug]/settings/audit-log page, detail modal |

## Objective

Build a paginated, filterable audit log viewer that allows OWNER, MANAGER, and SUPER_ADMIN users to browse the full history of business-critical mutations in their tenant. Each row can be expanded into a modal showing a human-readable before/after diff so that users can understand exactly what changed, when, and by whom.

## Instructions

### Step 1: Create the Page Route

Create the file at src/app/dashboard/[tenantSlug]/settings/audit-log/page.tsx. This is a Server Component that renders the page shell and delegates data fetching to a client-side data table. Add the route to the settings navigation sidebar under a heading such as "System" or "Compliance".

Guard the page with a server-side session check. If the authenticated user's role is CASHIER or STOCK_CLERK, redirect to the dashboard home. Otherwise render the page layout with the standard settings page container and heading "Audit Log" in Playfair Display.

### Step 2: Build the Filter Panel

Create a client-side filter panel component at src/components/audit/AuditLogFilters.tsx. The panel contains three controls rendered in a horizontal row on desktop and stacked on mobile:

- An Entity Type select dropdown populated with the distinct entity types: Sale, Return, Customer, StockAdjustment, Promotion, Staff, Expense, Shift, Settings. The first option is "All Types" which clears the filter.
- A date range picker composed of two date inputs labelled "From" and "To". Use the ShadCN Calendar or a pair of Input fields with type date. The from and to values map to startDate and endDate query parameters.
- An Actor select dropdown populated by fetching GET /api/users?role=MANAGER,OWNER,SUPER_ADMIN with minimal fields. The first option is "All Users".

The filter panel calls a provided onFilterChange callback whenever any filter value changes. Debounce the callback by 300 milliseconds using a useEffect pattern to avoid firing on every keystroke in date fields.

### Step 3: Build the Data Table

Create a client-side component at src/components/audit/AuditLogTable.tsx. The component accepts current filter state as props, manages its own pagination state (currentPage, pageSize), and fetches data from GET /api/audit-logs using TanStack Query. Construct the query key as an array containing "auditLogs" and the current filter and page state so that query cache entries are correctly keyed per filter combination.

The table has five columns:

| Column | Content |
|---|---|
| Entity Type | Display the entityType value as a ShadCN Badge with a consistent colour per type |
| Entity ID | Display the first 8 characters of entityId followed by an ellipsis |
| Action | Display the action string formatted for readability (e.g., replace underscores with spaces, apply title case) |
| Performed By | Display the related user's name, or "System" if userId is "SYSTEM" or the user relation is null |
| Date | Display createdAt in the format DD MMM YYYY, HH:mm using a locale-aware formatter |

Render a ShadCN Table with a tbody of rows. Each row has a cursor-pointer style and an onClick handler that opens the detail modal for that row. Below the table, render a pagination row showing "Showing X – Y of Z results" and Previous / Next buttons controlled by the page state. Disable the Previous button on page 1 and the Next button when the last page is reached.

Show a skeleton loader (ShadCN Skeleton rows matching the table structure) while the query is in the loading state. Show an empty state illustration with the text "No audit events found for the selected filters" when the data array is empty.

### Step 4: Build the Detail Modal

Create a client-side component at src/components/audit/AuditLogDetailModal.tsx. The modal is triggered by the table row onClick handler, receiving the selected AuditLog row as a prop.

The modal header shows the action name and the formatted date. A summary section below the header shows entity type, entity id, and the actor name.

The body renders the before/after diff. If both previousValues and newValues are present, iterate over the union of all keys from both objects. For each key, render a table row with three cells: the key name (in JetBrains Mono), the before value (in muted terracotta text, prefixed with a minus label), and the after value (in a slightly darker espresso text, prefixed with a plus label). If a key exists only in newValues (a new field was added), show "—" for the before cell. If a key exists only in previousValues (a field was removed), show "—" for the after cell.

If only newValues is present (a creation event), render a single-value display labelled "Created With" listing all key-value pairs. If neither is present, display an italicised message "No detail data recorded for this event."

Use a ShadCN Dialog with a max width of lg and a scrollable content area to handle large diff payloads.

### Step 5: Wire Everything Together

In the page.tsx, compose the AuditLogFilters and AuditLogTable components. Lift the filter state into the page using useState so that the filter panel and data table share the same state object. Pass the filterState down to AuditLogTable as props and pass the setFilterState callback down to AuditLogFilters as onFilterChange.

Add the audit-log route link to the settings sidebar navigation using the existing nav structure established in SubPhase 01.03. The label should read "Audit Log" and it should appear under a "System" or "Compliance" group heading.

## Expected Output

- Page accessible at /dashboard/[tenantSlug]/settings/audit-log with correct role guard
- Fully functional paginated table loading data from GET /api/audit-logs
- Filter panel that narrows displayed records by entity type, date range, and actor
- Detail modal showing a human-readable key-level before/after diff for each audit row
- Correct skeleton and empty states

## Validation

- [ ] Page redirects CASHIER users to the dashboard without rendering
- [ ] Table displays audit log rows with all five columns populated correctly
- [ ] Selecting an Entity Type filter updates the table results without a page reload
- [ ] Selecting a date range narrows results to events within that window
- [ ] Clicking a row opens the detail modal showing the action, date, actor, and diff
- [ ] The diff correctly shows "—" in the before column for keys that are new
- [ ] Pagination Previous and Next buttons work correctly and disable at boundaries
- [ ] Skeleton loader appears during initial fetch and during filter-triggered refetches

## Notes

- Entity type badge colours should use the VelvetPOS design palette: Sale badges in terracotta, Return badges in sand, Staff badges in espresso, Settings badges in mist. Use ShadCN Badge variant="outline" with inline className overrides for colour
- The diff renderer must handle nested objects in values — JSON.stringify the nested object value before displaying it in the cell rather than attempting recursive rendering, which is out of scope for this task
- Page size is fixed at 50 rows; a configurable page size selector is not required in this phase
