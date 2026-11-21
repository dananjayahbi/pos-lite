# Inventory list filters

## Form filter (ARGUS #141)

The inventory filter bar offers dosage-form chips (Powder, Oil, ...). Selecting
one writes `?forms=OIL` (comma-separated for several) and shows the filter count.

`GET /api/store/products` now:

1. keeps `forms` in `ProductListQuerySchema` (it used to be dropped before
   validation, so the API accepted and ignored it);
2. splits it into form values and passes them to `getAllProducts`;
3. filters products whose **live variants** include any selected form, matching
   case-insensitively (historical imports stored lowercase values).

A product with an oil variant therefore appears when Oil is selected, and the
form chip changes the actual result set instead of only the URL.

`useProducts` forwards the `forms` filter, and the regression test in
`src/lib/validators/__tests__/product.validators.test.ts` asserts the schema no
longer strips it.

## Stock-status filters and totals (ARGUS #142)

Low Stock and Out of Stock used to be filtered after pagination, so the count,
page rows and pager described the unfiltered catalogue (12 products, 6 matching
rows, 3 pages, empty pages). They are now resolved in `getAllProducts` before
the query's `skip`/`take`, so `total`, `totalPages` and the returned rows agree.

The status badge and both filters share `src/lib/inventory/stockState.ts`:

| Level   | Rule                                                                 |
| ------- | -------------------------------------------------------------------- |
| Variant | OUT at `stockQuantity <= 0`; LOW at `0 < qty <= lowStockThreshold`    |
| Product | OUT when **every** variant is OUT; LOW when any sellable variant is LOW |
| Product | A product without variants keeps the historical "in stock" state     |

Because Prisma cannot compare two columns, the service loads the tenant's live
variant quantities (product id, stock, threshold), groups them and pushes the
matching product ids into the product query. The badge renders the same
`getProductStockState` result, so a row labelled Out of Stock is exactly what the
Out of Stock filter returns. Tests: `src/lib/inventory/__tests__/stockState.test.ts`.

