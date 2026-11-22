# Stock-take creation audit

ARGUS #211.

Approval, rejection and cancellation already wrote an `AuditLog` row, but
creating a session did not, so the trail started only when someone acted on it.

`POST /api/store/stock-control/stock-takes` now writes
`STOCK_TAKE_CREATED` (`entityType: StockTakeSession`) after the session and its
items commit, with:

- `scope` (`all` or `category`) and the `categoryId` when scoped,
- `initiatedBy` (the session owner),
- `startedAt`.

The audit write is best-effort (`createAuditLog` swallows failures), so a
successful count is never rolled back because the trail write failed. The
completion row (`STOCK_TAKE_COMPLETED`) is written by the inventory service, and
approval/rejection/cancellation keep their existing actions.
