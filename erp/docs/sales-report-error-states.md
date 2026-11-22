# Report error states and retry (ARGUS #442)

Both Sales by Product and Profit & Loss now share one failure path:

- `resolveReportErrorMessage()` in `src/lib/reports/reportError.ts` reads the
  standard envelope on non-2xx responses and prefers `error.message`, so a 403
  (`Insufficient permissions`) and a 500 (`Failed to generate report`) are shown
  verbatim. A non-JSON body falls back to `Failed to fetch report (HTTP 502)`.
- Each page renders the message plus a **Retry** button that refetches the same
  range.
- `ReportContext` now tracks `reportStatus`. A failed page sets it to `error`,
  and `ReportLayout` hides the Export popover and Save Report dialog while the
  status is `error`, so the shell never offers to export a blank report.
  Loading sets `loading`; pushing rows sets `ready` and restores the controls.
- The page never renders stale rows after a failure: the error branch returns
  before the data branch.
