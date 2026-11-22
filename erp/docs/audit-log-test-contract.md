# Audit-log test contract (ARGUS #458)

The M35 Playwright suite had drifted from the live behaviour:

- **F9b** asserted `actorName` contained `@` or equalled `"Unknown user"`.
  The API resolves `actorId` through `staffDisplayName()` (`Owner`,
  `Cashier 1`), returns `System` for no actor and `Unknown` for a missing user,
  so the assertion could never pass. It now asserts the display-name contract
  (non-empty, never the raw id, never the obsolete `Unknown user`) and the
  table's current columns (`Entity ID`, `User`, `IP`, `Change`).
- **F5** only checked timestamps were `<=` the end-of-day bound, which passed
  while date-only `To` was parsed as midnight and hid same-day rows. It now
  also asserts a same-day From/To window returns today's rows when they exist.
- **F7/F7b/P3/X7** were pinned to the old 8-column, page-limited export. They
  now expect the 11 evidence columns (`userAgent`, `before`, `after`) and assert
  `X-Total-Rows` equals `meta.total` even beyond 100 rows.
- **F16** covers the facet lists: actions/entity types come from the ledger,
  not the old hardcoded 9/16 menu.
- **F9c/F9d/N5** cover the detail identity fields, the empty state for an
  impossible bookmarked filter, and the explicit error state (never the empty
  copy).

`auditDetailMode()`/`auditSnapshotRows()` unit tests pin before-only deletion
detail rendering, and `auditPresentation.core.test.ts` covers the shared action
labels, role labels, second/timezone timestamps and change summaries.
