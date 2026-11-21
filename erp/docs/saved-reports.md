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
