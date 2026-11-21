# Saved-report authorization and snapshot integrity

Every saved-report operation used to require only `report:view_sales`, so a
sales-only user could create/read a P&L, stock or customer artifact built from
arbitrary client rows, and a profit-only user could not save a P&L (ARGUS #446).

## Authorization

`savedReportPermission(reportType)` maps each report slug to its own permission
(`profit-loss` -> profit, `inventory-valuation`/`stock-movements` -> stock,
`customer-analytics` -> customers, `zero-value-sales` -> zero-value,
`recovery-staff-performance` -> recovery, sales-type reports -> sales). The list
only returns rows whose type the user may view; create, detail, rename, delete
and download check the permission of the stored report type. A route layout
redirects sessions with no report permission at all.

## Snapshot integrity

- New saved reports store `_snapshot: { asOf, source: 'CLIENT_SNAPSHOT' }` in the
  filters and the list shows "Snapshot as of ... - Open in App shows current
  data."
- Client columns are filtered against the report definition before generation;
  unknown columns are dropped and a fully unknown set falls back to the server
  column definition.
- The artifact is still a client data snapshot rather than a server re-run. A
  generic report runner does not exist in this codebase; the snapshot label and
  column validation make the contract explicit and prevent arbitrary columns.

## Verification

`savedReportAccess.core.test.ts` covers the permission map, snapshot metadata
and column filtering. `savedReportsList`/`savedReportArtifact` cover the list and
artifact states; `tsc` covers every call site.
