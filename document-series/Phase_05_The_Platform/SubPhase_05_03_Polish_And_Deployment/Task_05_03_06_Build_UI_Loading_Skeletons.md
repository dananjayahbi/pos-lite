# Task 05.03.06 — Build UI Loading Skeletons

## Metadata

| Field | Value |
|---|---|
| Task ID | 05.03.06 |
| Task Name | Build UI Loading Skeletons |
| SubPhase | 05.03 — Production Deployment and Polish |
| Complexity | Medium |
| Estimated Duration | 3–4 hours |
| Assignee Role | Lead Developer / UI Developer |
| Dependencies | TanStack Query integration on all data-fetching pages, Tailwind CSS 4, design tokens established |
| Output Files | src/components/skeletons/ — four skeleton components, plus updates to all list and report pages |

## Objective

Build a reusable library of loading skeleton components that display during TanStack Query's loading state on every data-fetching page in VelvetPOS. Skeleton loaders communicate to users that content is arriving, reducing perceived latency and preventing layout shift. Each skeleton component uses Tailwind's animate-pulse class combined with sand and mist palette backgrounds that harmonise with the VelvetPOS design system. Audit every current page that fetches data and integrate the appropriate skeleton variant.

## Instructions

**Step 1: Create the Skeleton Base Style**

Define a consistent skeleton block appearance used across all four components. Every skeleton element is a div with rounded corners (rounded-md) using the sand colour (#CBAD8D) at 40% opacity as the background (bg-sand/40 or an equivalent Tailwind CSS 4 arbitrary value). Apply the animate-pulse class to the wrapper container of each skeleton so the entire skeleton pulses together as a unit rather than each element pulsing independently. Use mist (#D1C7BD) for secondary skeleton elements such as sub-labels and smaller text placeholders, providing visual depth.

**Step 2: Build the TableSkeleton Component**

Create src/components/skeletons/TableSkeleton.tsx. The component accepts two props: columns (number, defaults to 5) and rows (number, defaults to 8). It renders a table-like structure using divs rather than actual table elements to avoid accessibility issues with partially-rendered data tables. The header row renders the same number of columns prop columns as rectangles with height 16px and varying widths (the first column is wider at w-32, subsequent columns are w-20) to simulate header text. Each data row renders the columns prop number of rectangles with height 12px and width w-full, with alternating slight opacity differences between even and odd rows to simulate row striping. Wrap the whole component in a div with animate-pulse and add a bottom border line below the header row in mist to delineate header from body.

**Step 3: Build the CardGridSkeleton Component**

Create src/components/skeletons/CardGridSkeleton.tsx. This component renders three skeleton stat cards in a responsive grid (grid-cols-1 on mobile, grid-cols-3 on desktop). Each card is a rounded-xl div with a linen (#EBE3DB) background and a sand inner skeleton block structure. Each card simulates a stat card layout: a small rectangular block at the top-left for the icon placeholder, a wider block in the middle for the metric value (height 32px, width w-24), and a narrow block at the bottom for the label (height 12px, width w-32). This matches the layout of the stat cards used on the reports overview and dashboard home page.

**Step 4: Build the ListSkeleton Component**

Create src/components/skeletons/ListSkeleton.tsx. The component accepts a single items prop (number, defaults to 6). It renders a vertical list of items prop skeleton rows, each representing a list entry as found in the customer list, supplier list, or staff list views. Each row is a flex container with a circular avatar placeholder on the left (w-10 h-10 rounded-full in sand), followed by two stacked text blocks on the right: the first is wider (w-48 h-4) representing the primary name, and the second is narrower (w-32 h-3) in a lighter mist tone representing the secondary sub-label. Add a bottom border on each row in linen to simulate the list dividers found in the actual list components. Separate rows with a gap-y-3 class on the container.

**Step 5: Build the ChartSkeleton Component**

Create src/components/skeletons/ChartSkeleton.tsx. This component renders a placeholder for the report chart areas. It renders a full-width rounded-xl card in linen with a fixed height of 320px. Inside the card, the skeleton simulates a bar chart: render a row of 7 evenly spaced vertical bars of varying heights (use hardcoded heights that appear natural, such as h-32, h-48, h-24, h-56, h-40, h-52, h-20 in flex-end alignment) in sand colour. Render thin x-axis and y-axis lines at the bottom and left of the chart area using 1px divs in mist. Above the bars, render a short w-48 h-5 rectangle at the top-left of the card to simulate the chart title.

**Step 6: Audit Pages and Integrate Skeleton Components**

Review every page in the project that uses TanStack Query's useQuery to fetch data. The following pages require skeleton integration:

The product list at /dashboard/[tenantSlug]/products should render TableSkeleton with columns={6} and rows={10} when isLoading is true or during Suspense fallback. The customer list at /dashboard/[tenantSlug]/customers should render ListSkeleton with items={8}. The POS terminal product search results panel should render a simplified ListSkeleton with items={6} during the product search query loading state, as the terminal panel is space-constrained. The revenue report, inventory report, and commission report pages should each render ChartSkeleton for their chart zones and TableSkeleton with the appropriate column count for their data table zones. The dashboard home page should render CardGridSkeleton for the top stat cards while TanStack Query fetches the summary metrics.

For pages that use Next.js Suspense boundaries rather than TanStack Query's isLoading, create a skeleton file co-located with the page (e.g., products/loading.tsx) that re-exports the appropriate skeleton component as the default export. Next.js treats loading.tsx files as the automatic Suspense fallback for that route segment.

## Expected Output

- src/components/skeletons/TableSkeleton.tsx — Configurable N-column × M-row table skeleton
- src/components/skeletons/CardGridSkeleton.tsx — 3-up stat card grid skeleton
- src/components/skeletons/ListSkeleton.tsx — Configurable N-item list skeleton with avatar
- src/components/skeletons/ChartSkeleton.tsx — Bar chart area placeholder skeleton
- src/components/skeletons/index.ts — Barrel export for all four components
- Updated loading.tsx or isLoading branches on: products page, customer list page, POS terminal product panel, reports pages, and dashboard home

## Validation

- [ ] TableSkeleton renders the correct number of columns and rows when props are varied
- [ ] All four skeletons use the animate-pulse class on their outer wrapper div
- [ ] Skeleton colours use only sand (#CBAD8D) and mist (#D1C7BD) from the VelvetPOS design palette
- [ ] The product list page shows TableSkeleton immediately upon navigation before data arrives
- [ ] The dashboard home page shows CardGridSkeleton while the summary metrics query is loading
- [ ] POS terminal product search panel shows ListSkeleton during the debounced query loading state
- [ ] Report chart areas show ChartSkeleton while TanStack Query fetches report data
- [ ] No layout shift occurs when skeleton transitions to real content (containers maintain fixed dimensions)

## Notes

- Avoid using real table elements (thead, tbody, tr, td) in skeleton components. Screen readers announce table elements with row and column count semantics, which would be confusing for "Loading…" placeholder content. Use divs with role="presentation" and aria-hidden="true" on the skeleton wrapper instead.
- Skeleton heights and widths should match the approximate dimensions of the real content they replace. If the real table row is 48px tall, the skeleton row should also be approximately 48px tall to prevent content jump when data loads.
