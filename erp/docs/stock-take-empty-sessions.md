# Empty stock-take sessions

ARGUS #212.

Selecting a category with no variants created a 0-item session. The page showed
`0/0`, Complete passed (nothing was uncounted) and the session could be approved
with zero corrections while holding the single in-progress slot.

Server-side guards:

- `POST /api/store/stock-control/stock-takes` counts the countable variants
  inside its transaction (tenant, live product, not archived, optional
  category). With zero it rolls back and returns `422 EMPTY_SCOPE`. This covers
  both a category with no variants and a store with no countable products.
- `POST .../complete` returns `400 EMPTY_SESSION` when the session has no items,
  so legacy empty sessions cannot be submitted as "verified".
- `POST .../approve` returns `400 EMPTY_SESSION` for the same reason.

`validateStockTakeScope` / `stockTakeHasNoItems` in
`src/lib/services/stockTakePolicy.core.ts` are the shared rules (unit tested).
