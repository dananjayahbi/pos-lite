# Task 05.03.07 — Build Empty State Components

## Metadata

| Field | Value |
|---|---|
| Task ID | 05.03.07 |
| Task Name | Build Empty State Components |
| SubPhase | 05.03 — Production Deployment and Polish |
| Complexity | Medium |
| Estimated Duration | 3–4 hours |
| Assignee Role | Lead Developer / UI Developer |
| Dependencies | All list and report pages exist, TanStack Query integrated, design tokens established |
| Output Files | src/components/empty-states/ — five empty state components, plus updates to all list and report pages |

## Objective

Create a library of context-specific empty state components that appear whenever a list view or report table contains zero records. Empty states replace the visually jarring experience of an empty table frame with a composed, branded illustration, an informative heading, supportive subtext, and an optional call-to-action that directs the user toward their next meaningful action. Every empty state must use the VelvetPOS design language and reflect the specific context in which it appears.

## Instructions

**Step 1: Design the Base EmptyState Structure**

All five empty state components share a common layout. Create a base structural pattern: a flex column div centred both horizontally and vertically with py-16 padding. Inside, render four elements in order: an SVG illustration zone (w-48 h-48, centred), a heading in Playfair Display 22px espresso (#3A2D28), a subtext paragraph in Inter 14px mist (#D1C7BD), and an optional CTA button in terracotta (#A48374) background with pearl (#F1EDE6) text rendered using a ShadCN Button component. The entire empty state is placed inside a full-width rounded-xl card with a linen (#EBE3DB) background to visually contain it within the page layout.

**Step 2: Build EmptyProductList**

Create src/components/empty-states/EmptyProductList.tsx. The SVG illustration depicts a simple flat-style clothing hanger outline: a single curved triangular hook shape at the top with a horizontal bar below it and a soft rounded bottom edge, drawn with a thin 1.5px mist-coloured stroke and no fill, on a sand-circle background. The heading reads "Your catalogue is empty". The subtext reads "Add your first product to begin building your inventory. Include variants for size and colour." The CTA button label is "Add Product" and calls an optional onAddProduct callback prop passed to the component.

**Step 3: Build EmptyCustomerList**

Create src/components/empty-states/EmptyCustomerList.tsx. The SVG illustration shows two overlapping circle outlines (representing person silhouettes) side by side, each with a small solid circle above it to represent a head, drawn with terracotta-toned mist strokes on a linen background. The heading reads "No customers yet". The subtext reads "Customer profiles are created automatically when a sale is completed, or you can add them manually." The CTA button label is "Add Customer" and calls an optional onAddCustomer callback prop.

**Step 4: Build EmptyOrderHistory**

Create src/components/empty-states/EmptyOrderHistory.tsx. The SVG illustration depicts a simple receipt outline: a tall narrow rectangle with a wavy bottom edge (representing a paper tear), three short horizontal lines inside representing line items, and a horizontal dividing line near the bottom for the total. Drawn with espresso-toned strokes at low opacity. The heading reads "No sales recorded yet". The subtext reads "Once the first sale is completed on the POS terminal, it will appear here." This component carries no CTA button since sales are created only via the terminal, not the history screen directly.

**Step 5: Build EmptyReportData**

Create src/components/empty-states/EmptyReportData.tsx. The SVG illustration shows three bar chart bars of ascending height (left to right) drawn as hollow rectangles with rounded tops in sand colour with an espresso outline, suggesting an upward trend that has not yet materialised. The heading reads "No data for this period". The subtext reads "Try adjusting the date range or check back after more sales have been recorded." This component accepts an optional onChangeDateRange callback prop that the CTA button — labelled "Adjust Date Range" — invokes. The CTA button is rendered only when the prop is provided, making it optional so the component can be used on reports that do not have a date picker.

**Step 6: Build EmptySearchResults**

Create src/components/empty-states/EmptySearchResults.tsx. This component accepts a required searchQuery prop (string) that is interpolated into the subtext. The SVG illustration shows a circular magnifying glass outline with a small "×" mark inside the lens, drawn in mist tones. The heading reads "No results found". The subtext reads "No matches for " followed by the searchQuery prop rendered in JetBrains Mono inside quotation marks, followed by ". Try a different search term or clear the filter." This component carries no CTA but an optional onClearSearch callback — when provided, render a "Clear Search" text button (variant ghost in ShadCN) below the subtext.

**Step 7: Integrate Empty States into All Applicable Pages**

Audit every page that renders a list or table and add empty state rendering when the data array has zero elements. Apply the following assignments:

On the products list page, wrap the TanStack Query result: when data exists and data.length is zero, render EmptyProductList with an onAddProduct callback that navigates to /dashboard/[tenantSlug]/products/new. On the customers list page, render EmptyCustomerList with an onAddCustomer callback. On the order history page (sales list), render EmptyOrderHistory. On every report page (revenue, inventory, commission reports), render EmptyReportData with an onChangeDateRange callback that focuses or opens the date range picker. On all search result displays — the POS product search, the global search bar results, and the customer search field — render EmptySearchResults with the current query string passed as the searchQuery prop.

In TanStack Query hooks, ensure the enabled option is correctly set: for search queries, set enabled to searchQuery.length >= 2 so the empty state is shown only for an active search that returned no results, not for an empty search field.

## Expected Output

- src/components/empty-states/EmptyProductList.tsx — Product catalogue empty state with Add Product CTA
- src/components/empty-states/EmptyCustomerList.tsx — Customer list empty state with Add Customer CTA
- src/components/empty-states/EmptyOrderHistory.tsx — Order history empty state without CTA
- src/components/empty-states/EmptyReportData.tsx — Report data empty state with optional date range CTA
- src/components/empty-states/EmptySearchResults.tsx — Search results empty state with query interpolation and Clear CTA
- src/components/empty-states/index.ts — Barrel export for all five components
- Updated products, customers, sales history, report, and search pages to render the appropriate empty state on data.length === 0

## Validation

- [ ] EmptyProductList renders when the product Prisma table is empty for a tenant and the seed has not been run
- [ ] EmptyReportData renders correctly when the selected date range contains zero sales records
- [ ] EmptySearchResults correctly interpolates the search query string using JetBrains Mono formatting
- [ ] CTA buttons in empty states navigate or trigger the correct actions
- [ ] onChangeDateRange and onClearSearch CTAs are omitted from the rendered DOM when their callback props are not provided
- [ ] All five empty state SVG illustrations are inline SVGs (no external image URLs) and render in the correct palette colours
- [ ] Empty states do not flash briefly before the skeleton loader — loading state shows the skeleton, not the empty state

## Notes

- The SVG illustrations described in this task are deliberately minimal — simple line-art outlines achievable with basic SVG path and shape elements. Do not use external icon libraries or image imports for these illustrations. The inline SVG approach keeps the bundle lightweight and allows terracotta/mist colour tokens to be applied via Tailwind's fill and stroke utilities.
- When a page has both a search field and a full list, take care to distinguish two empty scenarios: (a) the list is genuinely empty (no records in the database) — show EmptyProductList; (b) a search is active but returned no matches — show EmptySearchResults. These require separate conditional branches.
