# Failed Deliveries & Recovery queue (ARGUS #515)

The sidebar link "Failed Deliveries & Recovery" opened
`/reports/recovery-staff-performance`, which shows per-staff recovery counts and
has no failed-delivery list or actions.

## What changed

- Added the operational queue at `/delivery/failed`. It lists **FAILED** and
  **RETURNED** deliveries, their customer, failure reason, COD value and
  dispatch date, with an **Open recovery** action into the delivery detail page
  where the existing recovery controls live.
- The queue merges both status queries, deduplicates by delivery id and sorts
  by order reference (`mergeFailedDeliveries` in
  `src/lib/delivery/failedQueue.ts`).
- Summary cards show queue total, failed, returned and COD at risk.
- The sidebar entry now points at `/delivery/failed`. The staff performance
  report is still available as its own **Recovery Performance** entry under
  Reports & Audit.

The page uses the existing delivery list API and existing recovery endpoints;
no schema or new mutation API was needed.

## Verification

`src/lib/delivery/__tests__/failedQueue.test.ts` covers status filtering,
deduplication/sorting, COD summarisation and the recoverable-status predicate.
`store-nav.test.ts` now covers the new queue route alongside the retained
recovery report route.

## Residual

The queue caps each status query at 200 rows and shows a note when more exist.
Pagination or a combined server-side queue endpoint can be added if volumes grow.
