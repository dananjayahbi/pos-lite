# Stock adjustment product picker

ARGUS #196.

The picker searched `/api/store/products?search=…&limit=10` with no status
filter, silently capped at ten results, and swallowed failures into the normal
"No products found" message. Prefilled archived variants were rendered as if
they were active.

- Searches now send `status=active`, so archived products cannot be picked.
- A "Show more results" control raises the page size (10 → 20 → … → 50) instead
  of hiding the rest of the catalogue.
- A failed request sets a distinct `role="alert"` panel with the server message
  and a Retry button; "No active products found" is reserved for a successful
  empty search.
- `variant-lookup` now returns `product.isArchived`. A prefilled archived
  variant is labelled with an **Archived** badge and an explicit warning that it
  must only be adjusted to correct existing stock.
- Results still show name, category, brand and an `Archived` marker when the
  server ever returns one.

Server-side guards are unchanged: the adjust route still enforces
`stock:adjust`, tenant scope, the manual-reason allowlist, direction validation
and the stock bounds.
