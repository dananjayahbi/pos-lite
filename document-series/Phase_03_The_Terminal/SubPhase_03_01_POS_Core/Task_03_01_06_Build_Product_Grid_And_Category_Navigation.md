# Task 03.01.06 — Build Product Grid And Category Navigation

## Metadata

| Field | Value |
|---|---|
| Task ID | 03.01.06 |
| Task Name | Build Product Grid And Category Navigation |
| Sub-Phase | 03.01 — POS Core |
| Complexity | Medium |
| Dependency | Task_03_01_05 |
| Output Files | src/components/pos/ProductGrid.tsx, src/components/pos/ProductCard.tsx, src/components/pos/CategoryTabs.tsx |

## Objective

Build the left panel of the POS terminal: a horizontally scrollable category filter strip, a debounced search input, and an auto-filling product card grid that displays all active products for the current tenant with accurate stock status visualisation.

## Instructions

### Step 1: Fetch Product Data with TanStack Query

In the POS terminal page (or a dedicated data hook), set up a TanStack Query query with the key "pos-products" that fetches all active, non-archived products with their variants and stock levels by calling GET /api/products with an appropriate filter parameter. Configure the query with a staleTime of five minutes to avoid unnecessary refetches during a typical shift while still updating when the cashier navigates away and returns. The fresh data from this cache is the sole source of truth for both the category tabs and the product grid — no secondary API calls are made for category filtering or search within the loaded dataset.

The query should return a flat list of product objects, each containing: product id, name, imageUrl (nullable), category id and name, all active (non-deleted) variants with their sku, size, colour, retailPrice, and current stock quantity. The stock quantity for each variant comes from the VariantStockLevel join performed on the server. Pre-loading this data on terminal open ensures instant response when the cashier clicks a product or category without waiting for a loading spinner between interactions.

For tenants with more than 500 active products, a client-side scan of the full dataset on every keystroke becomes perceptibly slow. Detect this condition by checking the returned product count after the initial query resolves: if the count exceeds 500, set an "API search mode" flag in local component state, which causes subsequent search input keystrokes to call a debounced GET /api/products?query= endpoint instead of filtering the local cache.

### Step 2: Build the CategoryTabs Component

Create src/components/pos/CategoryTabs.tsx as a client component. It receives a list of unique categories (derived from the loaded product data) and a currently selected category id (null for "All Products"). Render a horizontal strip of pill-shaped tab buttons that scrolls horizontally if the total width overflows — use CSS overflow-x auto with a hide-scrollbar utility class to maintain a clean visual while still allowing scroll. Add touch-swipe support naturally via the overflow-x behaviour; no JavaScript gestures are needed.

The first tab is always "All Products" and uses the category id value of null. Each subsequent tab shows the category name in Inter font at 13px. The active tab style uses sand (#CBAD8D) as the background with espresso text and a slight bottom border accent also in sand. Inactive tabs use a transparent background with terracotta text, transitioning to a sand background at 50% opacity on hover. The transition should use a 150ms ease-in-out duration so the feel is crisp without being jarring on touch devices in a busy retail environment.

When a tab is clicked, fire the onCategoryChange callback passed as a prop from the parent, updating the selectedCategoryId state in the parent ProductGrid component. The CategoryTabs component itself is fully controlled and carries no internal state.

### Step 3: Build the POS Search Input

In the ProductGrid component, include a search input at the top of the left panel, above the CategoryTabs strip. The input has a magnifying-glass icon on the left and an "×" clear button that appears when the value is non-empty. Style the input with a mist (#D1C7BD) border that transitions to sand on focus, an espresso text colour, and a pearl (#F1EDE6) background. Placeholder text reads "Search products or scan barcode…" in mist.

Implement debouncing at 200ms using the useDebounce custom hook or useEffect with a cleanup timeout. The debounced value is used to filter the product list. Filtering logic: if API search mode is not active, compute a filtered subset of the TanStack Query cached data by checking whether the product name or any variant's sku includes the lowercased search term as a substring. For barcode matching, check the sku field with an exact prefix match (since partial barcodes are common during manual lookups). Clear the active category filter when a search term is entered, since searching across all categories is more useful than filtering within a pre-selected category.

### Step 4: Build the ProductCard Component

Create src/components/pos/ProductCard.tsx as a client component. Each card is approximately 140 pixels wide and 165 pixels tall. Structure: the upper 60% of the card shows the product image using a next/image Next.js Image component with object-cover fitting, or a clothing-hanger SVG placeholder when no image is available. The placeholder uses a terracotta icon on a linen background. The lower 40% contains the product name in Inter 13px with line-clamp-2 overflow wrapping, the price formatted as "Rs. X,XXX.00" in JetBrains Mono at 13px in terracotta, and a small stock badge at the bottom.

The stock badge logic works as follows. Compute the total stock across all variants of the product. If total stock is zero, show a "Out of Stock" badge using the danger colour (#9B2226) with a small dot indicator. If total stock is between 1 and 5, show a "Low" badge using the warning colour (#B7791F). If total stock is above 5, do not render a stock badge at all — the card presents clean without cluttering the primary product information.

When a product has zero stock across all variants, apply a full-card overlay: reduce the card's opacity to 60%, show a semi-transparent linen overlay, and display a centred "Out of Stock" label in small terracotta text. The card remains visible in the grid so cashiers can explain to customers why a product cannot be sold, but the card is visually distinct from available items.

Card click behaviour: if the product has zero total stock, show a ShadCN toast notification reading "This product is out of stock" rather than opening the variant modal. If the product has exactly one variant (after filtering out deleted variants), call the onAddDirectly callback passed from the parent to add the variant directly to the cart without any modal. If the product has two or more active variants, call the onOpenVariantModal callback, passing the product's id so the VariantSelectionModal can fetch and display the variant matrix.

### Step 5: Build the ProductGrid Component

Create src/components/pos/ProductGrid.tsx as the parent client component for the left panel. It holds selectedCategoryId and searchQuery as local state values. It derives the filtered product list by applying both the selected category filter and the search term filter to the TanStack Query data. The derived list is passed to a grid container.

The grid container uses CSS grid with the auto-fill repeat pattern and a minimum column width of 130px, allowing the grid to place as many tiles as possible given the available container width. The grid gap is 12px. The grid area has padding of 16px on all sides. When the product list is loading (isLoading from the query), show a skeleton grid of eight placeholder tiles — each the same size as a product card, using an animated shimmer effect with a linen background. When the product list is empty after filtering, show a centred "No products found" message with a grey clothing-hanger icon illustration.

Pass the following props down to each ProductCard: the product object, an onAddDirectly callback that calls the addItem mutation from useCartStore, and an onOpenVariantModal callback that sets an activeProductId state value in ProductGrid, which triggers the VariantSelectionModal.

## Expected Output

- src/components/pos/CategoryTabs.tsx with controlled horizontal-scrolling tab strip
- src/components/pos/ProductCard.tsx with image, price, stock badge, overlay state, and click routing
- src/components/pos/ProductGrid.tsx combining the TanStack Query data, category filtering, search filtering, skeleton loading, and empty state into the full left panel product area

## Validation

- The product grid loads all active, non-archived products on terminal open with a skeleton loading state visible briefly during the initial fetch
- Clicking a category tab filters the grid to show only products in that category; clicking "All Products" restores the full list
- Typing in the search field filters the grid within 200ms after the last keystroke
- Products with zero total stock across all variants show the greyed overlay and are not clickable for adding to cart
- Clicking a single-variant product tiles bypasses the modal and adds the item directly to the cart
- Clicking a multi-variant product tile sets the activeProductId and opens the VariantSelectionModal (verified in Task 03.01.07)

## Notes

- The 5-minute staleTime on the "pos-products" query is a performance trade-off: new products added to the catalog during a shift will not appear until the cashier refreshes the page or the stale time expires. This is acceptable for a retail environment where catalog changes are infrequent during active trading hours. If real-time catalog updates are required, a WebSocket or server-sent event approach can be added in a future phase.
- The auto-fill CSS grid approach (rather than a fixed column count) is preferred over a responsive grid with breakpoints because the POS terminal panel width varies continuously depending on whether the cart panel is expanded, the browser zoom level, and the monitor resolution. Auto-fill adapts to any width without requiring responsive class management.
- JetBrains Mono is used for prices specifically because monospace font renders number alignments consistently across a grid of product tiles, making it easy for cashiers to compare prices at a glance.
