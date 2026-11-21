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
