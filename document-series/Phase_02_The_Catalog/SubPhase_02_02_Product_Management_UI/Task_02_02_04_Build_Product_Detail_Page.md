# Task 02.02.04 — Build Product Detail Page

## Metadata

| Field        | Value                                                        |
| ------------ | ------------------------------------------------------------ |
| Task ID      | Task_02_02_04                                                |
| Sub-Phase    | 02.02 — Product Management UI                               |
| Complexity   | High                                                         |
| Depends On   | Task_02_02_03                                                |
| Route        | /dashboard/[tenantSlug]/inventory/[productId]               |
| File Target  | src/app/dashboard/[tenantSlug]/inventory/[productId]/page.tsx |

---

## Objective

Build the Product Detail page, which serves as the central view for all information about a single product. The page exposes a three-tab layout covering the product's core details, all of its variants with inline editing access, and the full stock movement history. Editing flows launch from this page via a right-side sheet rather than creating a separate edit route.

---

## Instructions

### Step 1: Create the Server Component Shell

Create the page at src/app/dashboard/[tenantSlug]/inventory/[productId]/page.tsx as a server component. It reads the productId from the route params and validates that it is a non-empty string before passing it to the client rendering layer. It uses Next.js generateMetadata to set the page title to the product name dynamically — this requires a server-side Prisma fetch of just the product name, keeping the title available before client hydration. Pass the productId and initial permissions down to the client component as props.

Guard the page with a product:view permission check in the server component — redirect to /dashboard/[tenantSlug]/inventory with a 302 if the user's session does not include this permission.

### Step 2: Build the Page Header Region

The page header is a full-width region with a linen background and a mist bottom border separating it from the tab content below. It contains:

- A breadcrumb line above the title using Inter small text in mist colour: "Inventory" (a link) → "[product name]"
- The product name in Playfair Display H1 with espresso colour, below the breadcrumb
- A horizontal row of metadata pills below the title: category name pill (sand background), brand name pill (sand background), and the status badge (using the ProductStatusBadge component from Task_02_02_01). If the product has no brand or category, those pills are omitted entirely
- A button group in the top-right corner of the header: an "Edit Product" button with a sand outline style, an "Archive" toggle button (shows "Archive" when status is ACTIVE, shows "Unarchive" when status is ARCHIVED) with mist outline style, and an overflow menu kebab icon that reveals a "Delete Product" danger item for OWNER roles only

The header section uses a two-column CSS grid on desktop — title and breadcrumb on the left, button group on the right, vertically centred.

### Step 3: Build the Three-Tab Layout

Create src/components/product/ProductDetailTabs.tsx. This component renders a ShadCN Tabs component with three triggers: "Details", "Variants", and "Stock History". The tab bar sits on an espresso background with sand-coloured underline indicators for the active tab. Tab trigger labels use Inter semibold in pearl colour when inactive and sand colour when active. The tab content panels have a linen background.

The active tab is synced with a ?tab= URL search param (values: details, variants, stock-history) using the useSearchParams hook. This makes the active tab bookmark-able and survivable across page refreshes. The default tab is details when no param is present.

### Step 4: Build the Details Tab

Create src/components/product/ProductDetailsCard.tsx. The Details tab renders a pearl-background card with a mist border. The content is a two-column definition list on desktop, stacking to single-column on mobile. Each row shows a field label in Inter small uppercase mist-coloured text on the left and the field value in Inter body espresso on the right.

Fields displayed in order: Name, Description (full text, wrapping), Gender, Tags (rendered as sand chips), Tax Rule, Category (shown as a clickable link to the category management page), Brand (shown as a clickable link to the brand management page), Created By (the user's display name), Created At (formatted as "17 March 2026, 14:30"), Last Modified (same format).

If the Description is longer than 200 characters, show the first 200 characters followed by a "Show more" toggle link that expands the full text inline — no separate page or dialog needed.

### Step 5: Build the Variants Tab

Create src/components/product/VariantsTab.tsx. This component fetches variants using the useProduct hook (which returns the full product with nested variants). The variants table has the following columns:

| Column              | Detail                                                            |
| ------------------- | ----------------------------------------------------------------- |
| Expand arrow        | Toggles the thumbnail row below the variant row                   |
| SKU                 | JetBrains Mono font, espresso colour                              |
| Barcode             | JetBrains Mono font, mist colour if empty                         |
| Size                | Inter text                                                        |
| Colour              | Inter text                                                        |
| Cost Price          | Right-aligned, Rs. format; entire column hidden for users without product:view_cost_price permission |
| Retail Price        | Right-aligned, Rs. format                                         |
| Wholesale Price     | Right-aligned, Rs. format; em-dash if not set                     |
| Stock               | Coloured badge: success colour (#2D6A4F) when at or above threshold, warning colour (#B7791F) when at threshold, danger colour (#9B2226) when zero |
| Low Stock Threshold | Plain integer                                                     |
| Actions             | "Edit" button and "Delete" icon; Edit opens the VariantEditSheet |

Deleting a variant requires product:delete permission and opens a confirmation dialog before proceeding. Soft-deleted variants are not shown in this table.

When a variant row is expanded, a sub-row appears directly below it, spanning all columns. The sub-row shows the variant's imageUrls as a horizontal row of 60 × 60 px thumbnails. If no images exist, the sub-row shows "No images uploaded" in mist italic text.

### Step 6: Build the Stock History Tab

Create src/components/product/StockHistoryTab.tsx. This tab contains a date range filter at the top: two date picker inputs (From and To) implemented using ShadCN's DatePicker component. The selected date range filters the stock movement query via URL params (?from=&to=) on the stock-history tab. Leave the range blank by default to show all movements.

The stock movements table fetches from GET /api/products/[id]/movements with pagination at 25 rows per page. Columns:

| Column        | Detail                                                                  |
| ------------- | ----------------------------------------------------------------------- |
| Date / Time   | Formatted as "17 Mar 2026, 14:30" in Inter small; click to show full ISO timestamp in a tooltip |
| Variant       | The variant's SKU in JetBrains Mono                                     |
| Type          | A badge showing the movement reason: SALE, RETURN, ADJUSTMENT, IMPORT, RECOUNT — each with a distinct colour using the design system palette |
| Delta         | The quantity change: positive values shown in success green with a + prefix, negative values in danger red with a − prefix |
| Before → After | Plain text showing the stock count before and after, separated by an arrow |
| Actor         | The display name of the user who triggered the movement                  |
| Note          | Optional free text in mist italic; em-dash if empty                     |

### Step 7: Build Edit and Delete Flows

The "Edit Product" button opens a ShadCN Sheet sliding in from the right. The Sheet header shows "Edit Product" in Playfair Display. The Sheet body contains a form pre-filled with the product's current Step 1 fields (name, description, category, brand, gender, tags, tax rule). This form uses the same Zod schema and field components as the wizard Step 1 form, but is a standalone Sheet form — not the Zustand wizard store. On save, the form calls PATCH /api/products/[id] via useMutation, shows a success toast "Product updated", closes the Sheet, and invalidates the useProduct query to refresh the page data.

The "Delete Product" menu item is visible only to OWNER roles. Clicking it opens a ShadCN Dialog with a danger heading "Delete Product". The dialog body explains that this action soft-deletes the product and all its variants and cannot be undone from the UI. Below the explanation, a text input prompts the user to type the product name exactly as it appears to confirm intent. The "Confirm Delete" button remains disabled until the typed value matches the product name. On confirmation, calls DELETE /api/products/[id], shows a toast "Product deleted", and redirects to /dashboard/[tenantSlug]/inventory.

---

## Expected Output

Navigating to /dashboard/[tenantSlug]/inventory/[productId] renders the product header with name, category/brand pills, status badge, and action buttons. The Details tab shows all product metadata in a two-column layout. The Variants tab shows the variants table with expandable image rows and Edit/Delete actions. The Stock History tab shows paginated movement records with date range filtering. The Edit Product sheet opens and allows saving changes.

---

## Validation

- Page title in browser tab matches the product name (set server-side via generateMetadata)
- Breadcrumb "Inventory" link correctly navigates back to the inventory list
- All three tabs render their content and switching tabs does not unmount the entire page
- Active tab state is preserved in the URL param and survives a browser reload
- Variants table hides the Cost Price column for users without product:view_cost_price
- Expanding a variant row shows image thumbnails if present, or the "No images" message if not
- Stock History date filter updates the URL params and re-fetches the correct movements
- Edit Product sheet pre-populates all fields from the current product record
- Delete confirmation button remains disabled until the product name is typed exactly
- Archive/Unarchive button correctly toggles the product status and refreshes the header badge

---

## Notes

- The useProduct hook (src/hooks/useProduct.ts) should fetch the product with nested variants in a single request to avoid waterfall loading — design the GET /api/products/[id] response to include the variants array inline
- Stock movements are fetched separately via a distinct useQuery call with its own cache key that includes the productId, date range, and page number — this prevents the product card from re-fetching when the history tab is paginated
- The product delete is a soft delete — it sets a deletedAt timestamp on the product and all its variants, but does not physically remove any database rows
- The VariantEditSheet component is built in Task_02_02_05 — in this task, only wire the "Edit" button to open a placeholder Sheet with "Coming in Task_02_02_05" text
