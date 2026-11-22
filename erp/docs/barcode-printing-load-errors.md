# Barcode printing - product fetch errors are not an empty catalogue

ARGUS #164: the picker had no error state. When `/api/store/products` failed,
it rendered "No variants match “…”" (including `No variants match “”` for a
blank search), indistinguishable from a genuinely empty catalogue.

## Behaviour

The picker now renders three distinct states:

1. **Loading** - skeleton rows.
2. **Error** - `role="alert"` headline "Products could not be loaded", the
   request message, and a Retry button that refetches (spinner while retrying).
   The text says explicitly that this is not an empty catalogue.
3. **Empty** - a blank search says "No active products with variants yet. Add
   products in Inventory first."; a search term says `No variants match
   “term”.`

`useProducts` already exposed `isError`/`error`/`refetch`; the client just did
not consume them. No API or query change.

## Verification

- `npx tsc --noEmit`
- `npx vitest run src/lib/barcode-printing.core.test.ts src/lib/barcode-printing-search.core.test.ts`
