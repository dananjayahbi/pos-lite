# Task 05.01.06 — Build Inventory Valuation Report

## Metadata

| Field        | Value                                                                         |
|--------------|-------------------------------------------------------------------------------|
| SubPhase     | 05.01 — Reporting and Analytics                                               |
| Phase        | 05 — The Platform                                                             |
| Complexity   | Moderate                                                                      |
| Dependencies | 05.01.02 (ReportLayout), ProductVariant, Product, SaleLine, Category models   |

---

## Objective

Build the Inventory Valuation report at `/dashboard/[tenantSlug]/reports/inventory-valuation`, listing all active product variants with their current stock quantity, cost price, computed stock value, and optional low-stock and dead-stock filters.

---

## Context

A boutique's stock on hand represents tied-up capital. Knowing the total value of inventory at cost — and identifying items that have not sold recently — enables smarter purchasing and markdown decisions. Because `Decimal` arithmetic is required to correctly multiply cost price by stock quantity across thousands of variants, `decimal.js` is mandatory throughout this report.

---

## Instructions

**Step 1: Create the page file**

Create `src/app/(dashboard)/[tenantSlug]/reports/inventory-valuation/page.tsx` as a Server Component. Extract `tenantSlug` and two optional boolean search params: `lowStock` (show only variants at or below their `lowStockThreshold`) and `deadStock` (show only variants with no sale in the last 90 days). Resolve `tenantId` from the slug.

**Step 2: Query all active product variants**

Call `prisma.productVariant.findMany` with a `where` clause filtering `tenantId` and `isActive: true`. Include the `product` relation (for product name and category) and select: `id`, `sku`, `name` (the variant label), `stockQuantity`, `costPrice`, `lowStockThreshold`, and `lastSaleDate` if the field exists, otherwise this will be computed in Step 4.

**Step 3: Apply low-stock filter**

If the `lowStock` param is truthy, extend the `where` clause to include only records where `stockQuantity` is less than or equal to `lowStockThreshold`. In Prisma this is expressed as `stockQuantity: { lte: prisma.productVariant.fields.lowStockThreshold }` — if Prisma does not support column-reference comparisons in this way for this version, fall back to fetching all records and filtering in JavaScript: keep rows where `variant.stockQuantity <= variant.lowStockThreshold`.

**Step 4: Compute last sale date for dead-stock detection**

To detect dead-stock, run `prisma.saleLine.groupBy` with `by: ["productVariantId"]`, selecting `_max: { createdAt: true }` across all completed sales for this tenant. Build a `Map<productVariantId, Date>` from the result. For each variant, look up its last sale date from the map. If the dead-stock filter is active, exclude variants whose last sale date is within the last 90 days (computed as `subDays(new Date(), 90)` from `date-fns`). Also exclude variants with no sales at all from the dead-stock filter, as these are separately categorised as "never sold".

**Step 5: Compute stock values with decimal.js**

For each variant, compute stock value as `new Decimal(variant.costPrice ?? 0).times(variant.stockQuantity)`. Serialise to a string with `.toFixed(2)`. Compute the grand total by summing all variant stock values using `decimal.js` accumulation: initialise a `Decimal('0')` accumulator and add each row's stock value in a `reduce` call.

**Step 6: Build the inventory table**

Render a ShadCN `Table` component with the following columns:

| Column       | Description                                                             |
|--------------|-------------------------------------------------------------------------|
| SKU          | Variant SKU in `font-mono`                                              |
| Product      | Parent product name                                                     |
| Variant      | Variant label (size, colour)                                            |
| Stock Qty    | `stockQuantity` — integer, right-aligned; red if at or below threshold |
| Cost Price   | `costPrice` in `font-mono`, right-aligned                               |
| Stock Value  | Computed `costPrice × stockQuantity` in `font-mono`, right-aligned     |
| Last Sale    | Last sale date formatted "d MMM yyyy" or "Never" if no sales           |

Include a sticky summary footer row showing: Total SKUs count, Total Units in Stock (sum of `stockQuantity`), and Total Stock Value. The footer should use `font-semibold` and the espresso `#3A2D28` text colour.

**Step 7: Build the filter toggle controls**

Above the table, add two ShadCN `Switch` components: "Low Stock Only" and "Dead Stock Only". Each switch, when toggled, updates the corresponding URL search param (`?lowStock=1` or `?deadStock=1`) via `router.push` in a client wrapper component. The active switch label should display in the terracotta colour to make the active filter state obvious.

When both filters are active simultaneously, apply both filter criteria — this produces the intersection (variants that are both low-stock AND dead-stock), which represents the most urgent inventory concern.

**Step 8: Add a summary card strip above the table**

Render three `Card` components in a row:
- "Total SKUs Active": count of all active variants before filtering.
- "Total Units In Stock": sum of all `stockQuantity` values (all active variants).
- "Total Stock Value": grand total stock value formatted as "LKR X,XXX,XXX.XX".

These three cards always reflect the unfiltered totals so the manager can see whole-portfolio context even when a filter is applied.

**Step 9: Connect ReportContext**

Call `setReportData` with the filtered variant array (flat rows with all seven column values as strings) so the export controls can export to CSV, Excel, or PDF.

---

## Expected Output

- Inventory Valuation page shows all active variants with correct stock values.
- "Low Stock Only" filter reduces the table to variants at or below their threshold.
- "Dead Stock Only" filter reduces the table to variants with no sale in 90 days.
- The summary footer row updates to reflect the filtered row count and totals.
- The three summary cards always show unfiltered portfolio totals.

---

## Validation

- [ ] Stock Value for a variant with `costPrice = 850` and `stockQuantity = 12` displays as `LKR 10,200.00`.
- [ ] Total Stock Value matches the sum of individual row stock values (no floating-point drift).
- [ ] Variants with `stockQuantity = 0` are included (they are valued at LKR 0.00, not excluded).
- [ ] The "Low Stock Only" switch filters correctly and the URL param is set to `?lowStock=1`.
- [ ] "Never" appears in the Last Sale column for variants with zero historical sales.
- [ ] A variant sold 89 days ago is NOT included in the dead-stock filter.
- [ ] A variant sold 91 days ago IS included in the dead-stock filter.
- [ ] The summary cards show full totals regardless of which filter toggles are active.
- [ ] Export via ReportContext includes only the currently-filtered rows.
