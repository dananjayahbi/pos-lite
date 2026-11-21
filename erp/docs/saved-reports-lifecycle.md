# Saved-report lifecycle safety (ARGUS #448)

## Delete

The Saved Reports page and the report-shell dialog now ask for confirmation
(`DeleteConfirmDialog`) before deleting a preset. Server-side `DELETE` removes
the stored object **before** the database row, so a storage failure can no
longer leave an unreferenced artifact; if the row delete fails afterwards the
preset remains and the delete can be retried.

## Rename

`PUT /api/reports/saved/:id` uses the same `zSafeShortText(100)` rule as
`POST`: trimmed, 1–100 characters, no `<`, `>` or backtick. The rename dialog
mirrors the rule (`validateSavedReportName`), shows the reason, caps the input
at 100 characters and disables Save while invalid. The server remains
authoritative.

## Audit

Create, rename, delete and artifact download now write best-effort audit rows
(`SAVED_REPORT_CREATED`, `SAVED_REPORT_RENAMED`, `SAVED_REPORT_DELETED`,
`SAVED_REPORT_DOWNLOADED`) with the actor, role, IP and user agent, plus the
before/after name/report type/format. Tenant scoping and per-report-type
permissions are unchanged.

Pure validation and tests: `src/lib/reports/savedReportValidation.core.ts` and
`src/lib/reports/__tests__/savedReportValidation.core.test.ts`.
