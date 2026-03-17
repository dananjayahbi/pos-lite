# Task 02.02.12 — Build Product Search and Filters

## Metadata

| Field        | Value                                                        |
| ------------ | ------------------------------------------------------------ |
| Task ID      | Task_02_02_12                                                |
| Sub-Phase    | 02.02 — Product Management UI                               |
| Complexity   | Medium                                                       |
| Depends On   | Task_02_02_01                                                |
| File Targets | src/components/inventory/InventoryFilterBar.tsx, src/components/inventory/ActiveFilterChips.tsx |

---

## Objective

Build the search and filter interface for the Inventory List page. All filter state is managed through URL search params rather than Zustand, making every filter combination bookmark-able and shareable. The interface includes a debounced search bar and a horizontal filter bar covering category, brand, gender, and status dimensions.

---

## Instructions

### Step 1: Build the Search Bar

The search bar is a full-width text input rendered directly above the data table and below the page header row. It has a sand 1 px border, a linen background when empty, and a pearl background when focused. Two adornments sit inside the input: a search magnifier icon (mist colour) on the left as a prefix, and a clear-input × button (terracotta colour) on the right that appears only when the input contains text. Clicking the × clears the input and removes the ?search= URL param.

The input uses Inter font for regular typed text and JetBrains Mono font when the entered string is 8 characters or more and contains no spaces — this bi-modal typography heuristic covers the common case where staff type a SKU or barcode into the search box.

Debouncing: the input updates the URL's ?search= param 300 ms after the user stops typing, using a useEffect with a clearTimeout cleanup to cancel pending updates on rapid keystrokes. Do not debounce the visual input value — the input field itself updates on every keystroke to avoid a laggy typing feel. Only the URL param update is debounced.

### Step 2: Build the InventoryFilterBar Component

Create src/components/inventory/InventoryFilterBar.tsx. This component renders a horizontal filter bar in a flex row directly below the search bar, separated by a 12 px vertical gap. The filter bar background is linen, matching the page, with no border of its own — the filters appear to float as part of the page.

The bar contains four filter controls, plus a "Filters" toggle button at the far right with a count badge:

**Category filter** — a ShadCN Popover that opens a CommandList (from ShadCN's Command component) allowing multi-select from the category tree. Top-level categories are shown as plain items. Children categories appear indented by 16 px under their parent, marked with a subtle mist chevron. Selecting any category adds its ID to the ?categories= URL param as a comma-separated list. The Popover trigger button shows "Category" when no category is selected, or "Category: [N]" when N categories are selected. The Popover has a search input at the top to filter the category list by name.

**Brand filter** — mirrors the Category filter but as a flat list (not a tree). Multi-select Popover with search. URL param: ?brands=.

**Gender filter** — rendered as a horizontal row of five chip-style toggle buttons: MEN, WOMEN, UNISEX, KIDS, TODDLERS. Multiple selections are allowed. Each chip uses sand outline when inactive and espresso fill with pearl text when active. Clicking an active chip deselects it. URL param: ?genders= as a comma-separated list of the enum lowercase values.

**Status filter** — rendered as five chip-style buttons: "All", "Active", "Archived", "Low Stock", "Out of Stock". Only one can be active at a time (radio-style, not multi-select). "All" clears the ?status= param; the others set it to the corresponding value. Chips use the same sand-outline / espresso-fill pattern as the gender filter. "Low Stock" chip uses warning text when active; "Out of Stock" uses danger text when active.

### Step 3: Build the "Filters" Toggle Button

At the right end of the filter bar, a secondary button labelled "Filters" with a funnel icon collapses or expands the full filter bar. When collapsed, only the search bar and this toggle button are visible. This saves screen real estate when filters are not in use.

When any filter (besides the search text) is active, the "Filters" badge shows a count: "Filters (3)". The count is computed by summing: the number of active category IDs, the number of active brand IDs, the number of active gender values, and 1 if a non-All status is active. The badge uses an espresso background with pearl text so it stands out against the sand button.

The collapsed/expanded state of the filter bar is stored in local component state (useState), not in the URL — it does not need to be preserved across navigation.

### Step 4: Build the ActiveFilterChips Component

Create src/components/inventory/ActiveFilterChips.tsx. This component renders a row directly below the filter bar whenever any filter is active. This row shows the active filter values as removable chips — one chip per active filter value.

Chip format: each chip shows a short label describing the filter and value (e.g., "Category: Shirts", "Brand: Levi's", "Gender: Men", "Status: Low Stock"). Chips have a sand background, espresso text, a 4 px border-radius, and a small × button on the right in mist colour. Clicking × removes that specific filter value by updating the URL search params. If the removed filter was the last value in a multi-select param (e.g., the only active category), the param is removed from the URL entirely.

At the right end of the chips row, a "Clear all filters" text link in terracotta colour appears whenever any filter chip is present. Clicking it removes all filter params from the URL at once (search, categories, brands, genders, status all cleared simultaneously using a single router.push call with a clean params object).

The search text is not shown as a chip in this row — the search bar already makes the active query visible.

### Step 5: Synchronise Filter State with URL

All filter components read their current value from the URL using Next.js's useSearchParams hook. They write changes back to the URL using the router.push method from useRouter, updating only the affected params while preserving all other existing URL params.

A shared utility function mergeSearchParams (src/lib/urlUtils.ts) handles this pattern: it accepts the current searchParams object and a partial update object, merges them, and returns the resulting URLSearchParams string. This prevents the common mistake of overwriting all URL params when updating a single filter.

The useProducts hook in Task_02_02_01 reads its fetch URL from these same URL params, so changing any filter automatically causes the hook to refetch with the correct parameters via TanStack Query's queryKey dependency.

---

## Expected Output

The Inventory List page renders the search bar and filter bar below the page header. Typing a product name or SKU into the search bar updates the URL after 300 ms and narrows the table. Selecting "Women" and "Active" chip filters adds the params to the URL and filters the table. The ActiveFilterChips row appears below the filter bar showing the active selections. Clicking × on a chip removes that filter. Refreshing the page with a filtered URL restores all filters correctly from the URL.

---

## Validation

- Search input updates the URL ?search= param with 300 ms debounce
- JetBrains Mono font applies to the search input when text is 8+ characters with no spaces
- Category Popover shows the two-level tree with child indentation in the CommandList
- Brand Popover shows a flat searchable list
- Gender chips support multi-select; espresso fill appears on active selections
- Status chips support single-select only; "All" deselects any active status
- "Filters" badge count correctly reflects the number of active non-search filter values
- ActiveFilterChips row renders one chip per active filter value
- Clicking × on a chip removes only that value, preserving other params
- "Clear all filters" removes all filter params in a single router.push
- Reloading a page with filters in the URL correctly restores the filter UI state

---

## Notes

- Do not use Zustand for any filter state — URL params are the single source of truth. This is a deliberate architectural decision to support sharing filtered views between staff members
- The mergeSearchParams utility is worth unit-testing independently before wiring it to the UI — a bug in this function would silently break filter updates for users
- The filter bar collapse state (expanded/collapsed) is the only piece of UI state that legitimately lives in useState rather than the URL, because it is a purely visual preference with no data-fetching implications
