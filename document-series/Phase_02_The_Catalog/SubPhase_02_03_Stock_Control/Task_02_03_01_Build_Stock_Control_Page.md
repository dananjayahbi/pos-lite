# Task 02.03.01 — Build Stock Control Page

## Metadata

| Field | Value |
|---|---|
| Task ID | 02.03.01 |
| Task Name | Build Stock Control Page |
| Parent Sub-Phase | SubPhase_02_03 — Advanced Stock Control |
| Complexity | Medium |
| Dependencies | SubPhase_02_01 complete, SubPhase_02_02 complete |
| Output Path | src/app/dashboard/[tenantSlug]/stock-control/page.tsx |

---

## Objective

Create the Stock Control landing page at the route /dashboard/[tenantSlug]/stock-control. This page serves as the entry point to all inventory management operations. It presents four summary KPI cards giving staff an at-a-glance view of inventory health, a conditional low stock alert banner, a navigation grid directing users to specific stock management workflows, and a recent activity table showing the latest stock movements across the tenant.

---

## Instructions

### Step 1: Create the Route Segment and Page File

Inside src/app/dashboard/[tenantSlug]/stock-control/, create a page.tsx file. This file is a React Server Component by default. Extract the tenantSlug parameter from the Next.js route params. Use this slug throughout the page to scope all data queries to the correct tenant. Apply the standard page wrapper that uses the linen background token for the full content area.

### Step 2: Apply the Espresso Sidebar Active State

The dashboard sidebar must show the "Stock Control" navigation item as the currently active section whenever the user is anywhere within the /stock-control segment. Check the sidebar navigation configuration file and ensure the Stock Control route entry has its path set to /dashboard/[tenantSlug]/stock-control so that Next.js's active link detection marks it correctly. The espresso sidebar background applies to the navigation rail; the pearl content card surfaces appear inside the main content area.

### Step 3: Add the Page Header

At the top of the pearl content area, render an H1 heading using the Playfair Display font class. The heading text is "Stock Control". Below the heading, add a subtitle in Inter with muted text colour: "Manage inventory levels, review movements, and conduct stock takes."

### Step 4: Fetch Summary Data for KPI Cards

The page requires four data points fetched server-side or via TanStack Query hooks. These are: the total count of non-deleted non-archived products for the tenant, the count of variants where stockQuantity is less than or equal to lowStockThreshold, the count of StockTakeSession records in PENDING_APPROVAL status for the tenant, and the total retail stock valuation (gated by the product:view_cost_price permission). Fetch these as a single parallel batch — either directly in the server component using Prisma queries, or by calling the relevant API routes via a prefetch pattern. Wrap fetches in error boundaries so a failed valuation fetch does not block the entire page.

### Step 5: Render the Four KPI Cards

Arrange the four cards in a responsive grid: four columns on large screens, two columns on medium screens, and a single column on small screens. Each card uses the linen background, a sand-coloured border, and a slight rounded corner radius.

The first card is "Total Products". Display the count as a large Playfair Display number in espresso colour. Below it, render Inter subtext: "Active products in catalog".

The second card is "Low Stock Variants". Display the count as a large number. If the count is greater than zero, wrap the number in a warning-coloured badge (using the warning token #B7791F with a light amber background). Below the count, render Inter subtext: "Variants at or below threshold". If the count is zero, the number and badge both render in the success semantic colour.

The third card is "Pending Stock Takes". Display the count. If the count is greater than zero, render the number in an info-coloured badge (using #1D4E89). Below, render Inter subtext: "Awaiting approval". If zero, render in neutral mist text.

The fourth card is "Total Stock Value (Retail)". Check whether the currently authenticated user holds the product:view_cost_price permission. If they do, display the value formatted as "Rs. X,XXX,XXX.00" using a locale-aware number formatter scoped to Sri Lankan Rupee formatting (no currency symbol from the formatter — prepend "Rs." manually for visual consistency). If the user lacks this permission, replace the numeric content with the text "Restricted" rendered in mist text colour, and add a small lock icon beside it.

### Step 6: Render the Low Stock Alert Banner

Immediately below the KPI card grid, conditionally render a warning-coloured alert banner if the low stock variant count is greater than zero. The banner uses the warning semantic colour (#B7791F) with a light amber background. The banner text reads: "X variants are at or below their low stock threshold." where X is the count. Include a right-pointing arrow link labelled "View Low Stock List →" that navigates to /dashboard/[tenantSlug]/stock-control/low-stock. The link must preserve the tenantSlug in the URL. If the count is zero, do not render the banner at all — avoid rendering an empty or hidden container.

### Step 7: Build the Navigation Grid

Below the banner, render a section with the heading "Quick Actions" in Inter medium weight. Below the heading, display three large navigation cards in a responsive three-column grid (single column on mobile).

The first card links to /stock-control/adjust and bears the label "Manual Stock Adjustment" with a secondary description "Add or remove stock with a reason and audit trail." Include a relevant icon (for example, an edit or plus-minus icon from the Lucide icon set). Gate this card on the stock:adjust permission — if the user does not hold this permission, render the card with reduced opacity, a muted cursor, and a lock icon overlay. Do not prevent rendering entirely; the greyed-out state communicates that the feature exists but is restricted.

The second card links to /stock-control/movements and bears the label "Stock Movement History" with description "Browse the complete audit trail of all inventory changes." Gate on the stock:view permission in the same way.

The third card links to /stock-control/stock-takes and bears the label "Stock Takes" with description "Conduct periodic inventory counts and apply variance corrections." Gate on the stock:take:manage permission.

All active (non-restricted) cards show an espresso-to-terracotta hover state that smoothly transitions background colour and lifts the card with a subtle shadow on hover.

### Step 8: Build the Recent Activity Table

At the bottom of the page, add a section with heading "Recent Activity" in Inter medium weight and an inline secondary link "View All Movements →" on the right side of the heading row leading to /stock-control/movements.

Fetch the last 10 StockMovement records for the tenant, ordered by createdAt descending. Join each movement with its associated ProductVariant (to get the SKU) and the actor User record (to get the actor's display name).

Render the movements in a ShadCN Table component. Use sand colour for the table header row background. Column definitions:

- Date and Time: formatted as "15 Jan 2025, 2:34 PM" using Inter text, left-aligned.
- SKU: the variant's SKU rendered in JetBrains Mono font class.
- Reason: a coloured badge. FOUND and PURCHASE_RECEIVED and INITIAL_STOCK use the success semantic colour. DAMAGED and STOLEN use the danger semantic colour. DATA_ERROR and STOCK_TAKE_ADJUSTMENT use the info semantic colour. RETURNED_TO_SUPPLIER and SALE_RETURN use the warning semantic colour.
- Delta: the quantityDelta value. Positive values render as "+12" in success green with bold weight. Negative values render as "-3" in danger red with bold weight.
- Actor: the actor's display name in regular Inter text.

Show a skeleton table placeholder (using ShadCN Skeleton components for each row) during any loading state. Show an empty state message "No recent stock movements" with a muted icon if no movements exist.

### Step 9: Handle Permission-Gated Content Gracefully

Throughout this page, avoid throwing errors or redirecting when a user lacks a specific permission. Instead, render a visually distinct restricted state inline. This approach ensures users at all permission levels can view the page and understand what functionality is available to them at higher roles, without being confused by unexpected redirects.

### Step 10: Wire Up the Page with TanStack Query Prefetching

If the page is implemented as a Server Component with client-side child components, use Next.js's prefetchQuery pattern to send data down from the server. Define client components for the KPI cards, low stock banner, and recent activity table separately so they can take advantage of TanStack Query's cache and display skeletons during suspense boundaries. Each client component subscribes to its relevant query key. The server component prefetches each query and passes dehydrated state through the HydrationBoundary wrapper.

---

## Expected Output

A fully rendered Stock Control landing page accessible at /dashboard/[tenantSlug]/stock-control displaying four KPI cards with real data, a conditional low stock banner, a navigation grid of three workflow cards with proper permission gating, and a ten-row recent activity table. The page loads without client-side errors and displays skeleton placeholders during data fetching.

---

## Validation

- Navigate to /dashboard/dev-store/stock-control after seeding the sample catalog from SubPhase_02_01_12. Confirm all four KPI card values are non-zero and match the seeded data.
- Confirm the Low Stock Alert banner appears if any seeded variants are below their threshold, and that it is absent if all variants are above threshold.
- Confirm the navigation card for Manual Stock Adjustment appears greyed out when logged in as a STOCK_CLERK role user (who lacks stock:adjust permission) and fully interactive when logged in as MANAGER or OWNER.
- Confirm the Total Stock Value card shows "Restricted" for STOCK_CLERK and shows the formatted rupee value for MANAGER and OWNER.
- Confirm the Recent Activity table shows the last 10 movements and that the View All Movements link navigates correctly.

---

## Notes

- The tenant context must be derived from the URL slug and cross-referenced against the authenticated session's tenantId. Do not allow a user to access stock data for a tenant they are not associated with — this is a critical multi-tenancy boundary.
- The stock valuation calculation (summing stockQuantity × retailPrice across all variants) can be computationally heavy on large catalogs. For Phase 2, run it synchronously on page load. A cached daily snapshot is a Phase 5 improvement.
- Formatting rupee values: Sri Lanka uses a comma as the thousands separator and a period for the decimal. Format as "Rs. 1,234,567.00". Avoid relying on the browser locale for this since the formatting must be consistent server-side too — implement a shared formatRupee utility in src/lib/format.ts.
