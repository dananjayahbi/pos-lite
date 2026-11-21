# Saved Reports load errors

An aborted or failed `GET /api/reports/saved` rendered "No saved reports yet. Save
a preset..." with no error or retry, so a 403/500 looked like an empty library
(ARGUS #447).

`SavedReportsListMode` makes error win over loading and empty. The page now shows
a red **Saved reports could not be loaded** card with a Retry button for any
query failure, and only shows the genuine empty invitation after a successful
zero-row response.

## Verification

`savedReportsList.core.test.ts` covers error precedence, loading, empty and
ready.
