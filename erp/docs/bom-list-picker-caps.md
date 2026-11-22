# BOM list pagination and picker search

ARGUS #254.

The BOM list fetched a fixed `limit: 50` with no page controls, and the
New/Edit form fetched only the first 100 raw materials, so anything beyond those
caps silently disappeared.

- The list now requests 25 rows with `page` state and Previous/Next controls
  driven by the API's `meta.totalPages`. A new search term resets to page 1.
- The ingredient picker fetches 50 materials per query and has a debounced
  **Search raw materials** field that resolves against the whole catalogue
  server-side (tenant-scoped by `GET /api/store/raw-materials`).
- Already-selected material rows are cached by id and kept in the option list
  when the current search no longer returns them, so editing a saved recipe
  never loses an ingredient label.
- The picker states how many materials are shown and invites a search instead
  of pretending the first page is the whole catalogue.

The eligible finished-product picker was already uncapped
(`listBomEligibleVariants`), so no change was needed there.
