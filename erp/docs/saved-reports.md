# Saved reports: canonical slugs

The saved-report API stores **renderable report slugs** (`profit-loss`, `sales`,
`inventory-valuation`, …, `saved`), derived from `REPORT_SLUGS` in
`src/lib/reports/report-config.ts`. It rejects route paths with 400 by design.

## Save Report (ARGUS #444)

Report pages share `ReportLayout`'s Save Report dialog. It used to POST
`pathname` (for example `/reports/profit-loss`), so every save failed
validation. The dialog now sends `normalizeReportType(reportType ?? pathname)`:

- `/reports/profit-loss` → `profit-loss`
- `/reports/inventory-valuation/` → `inventory-valuation`
- `profit-loss` → `profit-loss`
- `/reports/saved` → `saved`
- unknown/`/reports/unknown`/`//evil.com` → `null` (the Save button is disabled
  and the dialog refuses to submit)

The API schema stays strict; this is UI normalization, not a permissive API.
The `reportType` prop remains optional — pages that pass it can pass either a
path or a slug.

## Saved Reports page / Open in App

`buildSavedReportHref()` normalizes the stored `reportType` before composing
`/reports/<slug>` and returns `null` for legacy/unknown rows, which render a
disabled “Unknown report” action. The Saved Reports page groups rows by the
canonical report title instead of deriving a label from a path.

Pure normalizer/tests:
`src/lib/reports/report-config.ts` (`normalizeReportType`) and
`src/lib/reports/__tests__/report-type.test.ts`.

## Presentation and discovery (ARGUS #449)

- `/reports/saved` no longer inherits the report shell's date range, Export or
  Save Report controls (or the duplicate Saved Reports dialog trigger); the
  report sidebar stays available.
- Filters render as labelled chips (`From 2026-10-01`, `Category OILS_LIQUIDS`)
  instead of raw JSON. The internal `_snapshot` key is hidden; unknown or nested
  values fall back to `Saved filter` rather than printing JSON.
- Created/Updated and every "data as of" value use the app's en-GB
  `formatShortDateTime` helper. Each row always states the data-as-of time: the
  saved snapshot timestamp when present, otherwise the artifact generation
  (updated) time.
- The list has case-insensitive search (name, report type, format, filter
  values) and pages at 10 presets with Previous/Next and a range summary.
- CSV and XLSX artifacts now start with the same `AyurPOS - <title>` and date
  range lines as the PDF (`reportArtifactMetaLines`), separated from the table
  header by one blank row.

Helpers live in `src/lib/reports/savedReportsList.core.ts` and
`src/lib/reports/reportArtifactMeta.core.ts`; their tests cover chips, search,
pagination and metadata line construction.

## UI coverage (ARGUS #450)

The API-only suite allowed the primary UI action to regress. The UI request and
link builders are now pure and tested:

- `buildSavedReportRequest()` (`savedReportPayload.core.ts`) pins the Save
  Report body: canonical slug (a path is normalized, `//evil.com` is refused),
  trimmed 1–100-char name, format, rows, columns and date range.
- `buildSavedReportHref()` / `savedReportDownloadHref()`
  (`savedReportLink.core.ts`) pin legacy-row fallback: a stored path is
  re-composed from its slug, unknown/protocol-relative rows return `null`, and
  download/view URLs encode the id.
- The same rules are asserted against the live app in
  `tests/34_reports_analytics.spec.ts`: F10 UI save payload, F11 artifact
  existence/download, F12 legacy-row fallback, F13 page error state and F14
  delete confirmation. Per-type authorization is covered by
  `savedReportAccess.core.test.ts` (a sales-only permission cannot read P&L,
  stock or zero-value presets).
