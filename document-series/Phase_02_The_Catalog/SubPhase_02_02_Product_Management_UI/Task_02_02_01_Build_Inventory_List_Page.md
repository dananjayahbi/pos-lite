# Task 02.02.01 — Build Inventory List Page

## Metadata

| Field        | Value                                      |
| ------------ | ------------------------------------------ |
| Task ID      | Task_02_02_01                              |
| Sub-Phase    | 02.02 — Product Management UI              |
| Complexity   | Medium                                     |
| Depends On   | SubPhase 02.01 fully complete              |
| Route        | /dashboard/[tenantSlug]/inventory          |
| File Target  | src/app/dashboard/[tenantSlug]/inventory/page.tsx |

---

## Objective

Build the main inventory landing page that gives OWNER and MANAGER roles a full paginated overview of all products belonging to the current tenant. CASHIER roles can view the list but cannot see the Add Product button, Archive action, or Delete action. The page serves as the hub for navigation into product detail, creation, export, and csv import features.

---

## Instructions

### Step 1: Create the Page Component

Create src/app/dashboard/[tenantSlug]/inventory/page.tsx as a server component that reads the tenantSlug from the route params and passes it to the client-side InventoryListClient component. The server component also fetches the initial product count server-side for the page title subtitle using Prisma directly, keeping the count instantly available on first render without a loading flash.

The page component extracts the current user session via the getServerSession helper from Phase 01 and passes the resolved permissions object to the client component so permission gates can render without a round-trip.

### Step 2: Build the Page Header Row

The page header is a horizontal flex row with three elements. On the left: the heading "Inventory" in Playfair Display H1 with espresso colour, and a subtitle line in Inter that reads "X products" where X is the total count returned from the initial fetch — this updates reactively when the TanStack Query data resolves. On the right: an "Add Product" button using the espresso background with pearl text, which links to /dashboard/[tenantSlug]/inventory/new. This button is conditionally rendered — it only shows when the current user has the product:create permission. An "Import CSV" secondary button with a sand outline sits next to Add Product and links to the import route.

### Step 3: Build the useProducts Hook

Create src/hooks/useProducts.ts. This hook accepts a filters object containing search, categoryIds, brandIds, genders, statuses, page, and limit fields. It constructs a URLSearchParams string from these values and calls GET /api/products with that query string. Configuration: staleTime of 30 000 milliseconds, keepPreviousData enabled so pagination transitions do not flash to a loading state. The hook returns the products array, total count, page info, and status flags.

### Step 4: Build the InventoryTable Component

Create src/components/inventory/InventoryTable.tsx. The table uses a sand-coloured header row with Inter font labels. Each data row has a pearl background with a terracotta hover highlight applied via Tailwind on the tr element. Columns are as follows:

| Column         | Description                                                                 |
| -------------- | --------------------------------------------------------------------------- |
| Checkbox       | Selects the row for bulk operations; header checkbox selects all visible rows |
| Product Name   | Displays a small 40 × 40 px thumbnail from the first variant image, or a clothing icon placeholder in mist colour if no image exists. Product name in Inter semibold next to it |
| Category       | Plain text category name, or an em-dash if uncategorised                    |
| Brand          | Plain text brand name, or an em-dash if no brand                            |
| Gender         | Rendered as a small pill badge with sand background and espresso text       |
| Variants       | Numeric count of non-deleted variants                                       |
| Total Stock    | Sum of stockQuantity across all non-deleted variants                        |
| Status         | ProductStatusBadge component — see Step 5                                  |
| Actions        | Icon button row: View (links to detail page), Archive toggle, Delete        |

The table skeleton state shows eight rows of ShadCN Skeleton components matching the column widths during the initial load.

The empty state — shown when the query returns zero results — displays a friendly illustration placeholder (a coat-hanger SVG icon in mist colour), a heading "No products yet" in Playfair Display, a subtitle "Start building your catalog", and the espresso "Add Product" button. If the empty state is due to active filters returning no results, replace the heading with "No products match your filters" and the action with a "Clear filters" text link.

### Step 5: Build the ProductStatusBadge Component

Create src/components/inventory/ProductStatusBadge.tsx. The component receives a status string and renders a small rounded pill badge. The status logic is:

| Status      | Background | Text           | Condition                                        |
| ----------- | ---------- | -------------- | ------------------------------------------------ |
| Active      | #2D6A4F    | pearl          | Product is active and all variants above threshold |
| Low Stock   | #B7791F    | pearl          | Product is active and at least one variant is at or below its lowStockThreshold |
| Out of Stock | #9B2226   | pearl          | Product is active and at least one variant has stockQuantity of zero |
| Archived    | mist       | espresso       | Product status is ARCHIVED                       |

Low Stock and Out of Stock conditions take priority over Active when any variant meets those criteria. Out of Stock takes priority over Low Stock.

### Step 6: Wire Up Row Selection to Zustand

Create src/stores/inventorySelectionStore.ts as a Zustand store with a selectedProductIds set. The store exposes toggleProduct, selectAll, clearSelection, and a computed isSelected selector. The InventoryTable passes checkbox onChange events to these store actions. When selectedProductIds is non-empty, the BulkActionBar component (built in Task_02_02_07) becomes visible.

### Step 7: Add Pagination Footer

At the bottom of the InventoryTable, render a pagination row that shows "Showing X–Y of Z results" in Inter small text on the left, and a page number navigation with Previous and Next buttons on the right. Pagination uses URL params: ?page=1&limit=25. The limit is fixed at 25 for the initial build. Changing the page calls router.push with the updated page param, which triggers the useProducts hook to re-fetch. The pagination is hidden when total results are 25 or fewer.

---

## Expected Output

Navigating to /dashboard/[tenantSlug]/inventory renders the inventory list page with the header, the data table populated with real product data, and pagination controls. Clicking "Add Product" navigates to the creation wizard. Selecting rows via checkboxes causes a floating action bar to appear at the bottom. Clicking any product's View action navigates to the product detail page. The page is responsive and usable on tablet viewport widths.

---

## Validation

- The page renders without console errors on first load
- All five columns display correct data fetched from the /api/products endpoint
- Skeleton rows appear during loading and are replaced by real data on completion
- Empty state renders when the product list is empty, with both the "Add Product" CTA and the filter-specific variant
- ProductStatusBadge shows the correct colour for each status condition
- Selecting checkboxes updates the Zustand selection store and causes the bulk action bar area to mount
- Pagination controls update the URL param and the table re-fetches the correct page
- CASHIER visiting this page does not see the Add Product button, Archive action, or Delete action column

---

## Notes

- The server component wrapper is intentional — it allows the page to set the document title metadata using Next.js generateMetadata, which is not possible in a pure client component
- The clothing icon placeholder should be an inline SVG so it does not require an additional network request and always renders even when the CDN is unavailable
- The Actions column Delete button requires product:delete permission. Clicking it should open a confirmation dialog before proceeding, not trigger an immediate delete — this guard is enforced in the InventoryTable component itself
- Do not store the current page number in Zustand. It must live exclusively in the URL to support bookmark-ability and browser history navigation
