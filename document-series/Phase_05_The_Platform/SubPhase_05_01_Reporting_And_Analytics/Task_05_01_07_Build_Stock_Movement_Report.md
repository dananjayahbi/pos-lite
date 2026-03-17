# Task 05.01.07 — Build Stock Movement Report

## Metadata

| Field        | Value                                                                  |
|--------------|------------------------------------------------------------------------|
| SubPhase     | 05.01 — Reporting and Analytics                                        |
| Phase        | 05 — The Platform                                                      |
| Complexity   | Moderate                                                               |
| Dependencies | 05.01.02 (ReportLayout), StockMovement, ProductVariant, User models    |

---

## Objective

Build the Stock Movement report at `/dashboard/[tenantSlug]/reports/stock-movements`, presenting a paginated log of all stock movement records with type filtering, a variant search, and a summary section counting net units by movement type.

---

## Context

Every stock change in VelvetPOS — a sale, a purchase order receipt, a manual adjustment, or a return — is recorded as a `StockMovement` entry. This report makes the full audit trail navigable and filterable, giving stock clerks and managers a clear picture of how inventory levels changed over time and who made each change.

---

## Instructions

**Step 1: Create the page file**

Create `src/app/(dashboard)/[tenantSlug]/reports/stock-movements/page.tsx` as a Server Component. Extract `tenantSlug`, `from`, `to`, `page` (default `"1"`), `variantSearch` (optional string), and `movementType` (optional string) from `searchParams`. Resolve `tenantId` from the slug.

**Step 2: Query the paginated StockMovement records**

Call `prisma.stockMovement.findMany` with:
- `where.tenantId` equals the resolved `tenantId`.
- `where.createdAt` between the `from` and `to` Date objects.
- If `variantSearch` is non-empty, include a nested `productVariant.product.name` contains filter using `{ productVariant: { product: { name: { contains: variantSearch, mode: "insensitive" } } } }`.
- If `movementType` is non-empty, include `where.type` equals `movementType`.
- `include: { productVariant: { include: { product: true } }, actor: { select: { id: true, name: true } } }`.
- `orderBy: { createdAt: "desc" }`.
- `take: 50` (page size) and `skip: (pageNumber - 1) * 50`.

Also run `prisma.stockMovement.count` with the same `where` clause to compute the total record count for pagination.

**Step 3: Query the movement type summary**

To populate the summary section, run `prisma.stockMovement.groupBy` with `by: ["type"]`, the same `where` clause (but without pagination), selecting `_sum: { delta: true }` and `_count: { id: true }`. This yields each movement type with its net delta and event count for the period.

**Step 4: Build the paginated table**

Render a ShadCN `Table` component with the following columns:

| Column          | Description                                                              |
|-----------------|--------------------------------------------------------------------------|
| Date            | `createdAt` formatted as "d MMM yyyy, HH:mm"                             |
| Product         | Parent product name                                                      |
| Variant         | Variant label and SKU in `font-mono`                                     |
| Movement Type   | Type as a ShadCN `Badge` — colour-coded by type (see Step 5)            |
| Delta           | `delta` value prefixed with `+` for positive, `−` for negative, in `font-mono`; green for positive, red for negative |
| Actor           | User name of the actor who triggered the movement                        |
| Reference       | `saleId` or `purchaseOrderId` if present, rendered as a link to the relevant record; otherwise "Manual" |

Render a `TableCaption` below the table showing "Showing X–Y of Z records".

**Step 5: Assign badge colours by movement type**

The following colour scheme should be applied via a `getMovementTypeBadgeVariant` helper:
- `SALE` → espresso-coloured badge (dark).
- `RETURN` → sand `#CBAD8D` badge.
- `PURCHASE_RECEIPT` → a green success variant.
- `ADJUSTMENT_IN` → a blue informational variant.
- `ADJUSTMENT_OUT` → an orange warning variant.
- `WRITE_OFF` → a destructive (red) variant.

Any unrecognised type falls back to the default ShadCN badge.

**Step 6: Build the filter controls**

Build a `StockMovementFilters` client component (placed above the table) containing:
- A text input for `variantSearch` with a debounced `onChange` handler (250 ms delay) that updates `?variantSearch=` in the URL.
- A ShadCN `Select` dropdown for `movementType` with options built from a static array: All Types, Sale, Return, Purchase Receipt, Adjustment In, Adjustment Out, Write-Off. Selecting an option updates `?movementType=` in the URL.

Both filter interactions use `router.push` to update the URL, which causes the Server Component to re-run with new params. Ensure the `page` param is reset to `"1"` whenever a filter changes.

**Step 7: Build the pagination controls**

Render a pagination strip below the table using Previous and Next buttons, plus a "Page X of Y" indicator. Previous is disabled when `page` equals 1; Next is disabled when the current page is the last page. Each button updates `?page=` via `router.push` with all existing search params preserved.

**Step 8: Build the movement type summary section**

Render a horizontal strip of ShadCN `Card` components above the filters, one per movement type present in the `groupBy` result. Each card shows the type badge, the net delta (sum of `delta` values), and the event count. This gives a quick breakdown without requiring the user to scan every row.

**Step 9: Connect ReportContext**

Call `setReportData` with the complete (un-paginated) first 1,000 rows fetched via a separate `findMany` without `skip`/`take` for export purposes. Export of very large datasets is intentionally capped at 1,000 rows with a UI note informing the user to narrow the date range for a full export.

---

## Expected Output

- Stock Movements page loads a paginated table of movement records.
- Variant search and type filter narrow the table and reset to page 1.
- Movement type badges are colour-coded correctly.
- Delta values are green (positive) or red (negative) with the +/− prefix.
- Reference column links to the relevant sale or purchase order when the reference id is present.
- Summary cards above the filters show net movement per type.

---

## Validation

- [ ] Navigating to page 2 shows the next 50 records in reverse chronological order.
- [ ] Filtering by movement type "PURCHASE_RECEIPT" shows only purchase receipt records.
- [ ] Searching by variant name "Batik" returns only rows for variants whose product name contains "Batik".
- [ ] A `SALE` movement with `delta = -2` displays `−2` in red.
- [ ] A `PURCHASE_RECEIPT` movement with `delta = 50` displays `+50` in green.
- [ ] The summary card for "SALE" type shows the correct sum of negative deltas for the period.
- [ ] Changing the date range in `ReportLayout` resets pagination to page 1 and re-queries.
- [ ] The Reference column displays a clickable link for records with a non-null `saleId`.
