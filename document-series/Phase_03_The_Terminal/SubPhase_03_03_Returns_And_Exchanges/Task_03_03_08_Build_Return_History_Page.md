# Task 03.03.08 — Build Return History Page

## Metadata

| Field          | Value                                                                     |
| -------------- | ------------------------------------------------------------------------- |
| Task ID        | 03.03.08                                                                  |
| Name           | Build Return History Page                                                 |
| SubPhase       | 03.03 — Returns and Exchanges                                             |
| Status         | Not Started                                                               |
| Complexity     | MEDIUM                                                                    |
| Dependencies   | Task_03_03_07 complete (GET /api/returns route)                           |
| Output Files   | src/app/dashboard/[tenantSlug]/pos/(terminal)/returns/page.tsx, src/components/pos/ReturnDetailModal.tsx |

---

## Objective

Build a dedicated Return History page accessible from the POS terminal's top navigation bar. This page allows managers and cashiers to browse all return transactions, filter by date and method, and drill into individual return detail to view line-level information.

---

## Context

The Return History page is a read-only audit view. It does not allow editing or reversing returns — all return records are immutable once created. The page is accessible within the POS terminal layout (full-screen, no sidebar) via a "Returns" link in the top bar. Given that cashiers can only view returns and managers can also access them for reconciliation, access is open to any authenticated user with `pos:access` permission.

---

## Instructions

### Step 1: Create the Page Route

Create `src/app/dashboard/[tenantSlug]/pos/(terminal)/returns/page.tsx`. This page uses the POS terminal layout (the full-screen layout without the dashboard sidebar, established in SubPhase_03_01).

Add a link to this page in the POS terminal's top navigation bar — next to the existing "Sales History" link. Label the link "Returns".

### Step 2: Implement Data Fetching

Use TanStack Query with a query key of `["returns", tenantSlug, filters]` to fetch from `GET /api/returns`. The query is parameterized by the filter state (described in Step 3). Set `staleTime` to 30 seconds.

Implement pagination: track `page` state (integer, starts at 1) and reset to 1 when filters change. Fetch with `limit=25`.

### Step 3: Build the Filter Bar

Above the table, render a horizontal filter bar with:

- A date range picker (two ShadCN `Popover`-based date inputs — "From" and "To"). Clear buttons for each.
- A ShadCN `Select` for Refund Method (All, Cash, Card Reversal, Store Credit, Exchange).
- A text search input for searching by Original Sale reference (debounced, 300ms). This passes an `originalSaleId` query param.
- A "Clear Filters" button that resets all filters to their default empty state.

All filter changes trigger a new query (after debouncing where appropriate).

### Step 4: Build the Returns Table

Render a ShadCN `Table` with the following columns:

- Return Ref — a short version of the UUID (first 8 characters, uppercase) rendered in JetBrains Mono with a tertiary muted style.
- Original Sale Ref — same short-UUID format, but rendered as a clickable link that opens the Sale Detail modal (the same modal from Sale History).
- Date — formatted as "DD MMM YYYY HH:mm" in the tenant's local time.
- Items Returned — total count of items returned (sum of all `ReturnLine.quantity` values).
- Refund Amount — right-aligned in JetBrains Mono format (Rs. X,XXX.XX).
- Refund Method — a ShadCN `Badge` with color coding: CASH in success green, CARD_REVERSAL in info blue, STORE_CREDIT in secondary muted, EXCHANGE in terracotta (#A48374 background, white text).
- Restocked — a checkmark icon in success color if all lines have `isRestocked: true`; a dash icon if any lines have `isRestocked: false`; a warning triangle if mixed.
- Authorized By — the authorizing manager's display name (first name + last name).

A final Actions column with a single "View" button that opens the ReturnDetailModal.

Show a Skeleton table while loading. Show an empty state illustration ("No returns found") when the filtered result is empty.

### Step 5: Build the ReturnDetailModal

Create `src/components/pos/ReturnDetailModal.tsx`. This is a ShadCN `Dialog` (not a Sheet — the full detail fits in a centered modal).

Modal header: "Return [shortRef]" with the return date.

Content:
- A summary grid: Original Sale, Cashier (initiatedBy name), Manager (authorizedBy name), Refund Method badge, Refund Amount (JetBrains Mono), Restock toggle status, Return Reason.
- A table of ReturnLines: Product Name, Variant, Qty Returned, Refund per Line, Restocked (boolean icon).
- A footer section: an "Original Sale" link that opens the Sale Detail modal (stacked modals are acceptable here), and a "Print Return Receipt" button.

---

## Expected Output

- A Return History page at `/pos/returns` with filters, paginated table, and detail modal
- The POS terminal top bar has a Returns navigation link

---

## Validation

- Filtering by refund method CASH shows only CASH returns
- Filtering by date range correctly excludes returns outside the range
- The detail modal shows correct line-level data
- The Restocked column correctly reflects mixed and all-restocked states
- Pagination controls work correctly (Previous and Next, page count display)

---

## Notes

The "Print Return Receipt" button in the detail modal calls `window.print()` and uses the same `@media print` print layout built in Task_03_03_10. Ensure the `ReturnReceiptDocument` component is structured so it can be rendered both inside the ReturnReceiptDialog (after a live return) and the ReturnDetailModal (for historical reprints).
