# Dispatch Orders defaults to the dispatch queue with counts

The page defaulted to **All statuses** over every delivery, including finished
and cancelled work, showed no per-status counts, and was titled "Orders" while
the sidebar said "Dispatch Orders" (ARGUS #269).

## Behaviour

- The heading is now **Dispatch Orders**.
- The default selection is the dispatch queue (`PLACED` + `PENDING_DISPATCH`).
  "All statuses" and every individual status remain one click away.
- The API accepts `statuses=PLACED,PENDING_DISPATCH` and
  `includeCounts=1`; counts are grouped over the current search scope, ignoring
  the status filter, so the summary still shows the other buckets.
- Each select option shows its count (`pending dispatch (12)`), and a small
  summary shows delivered/cancelled totals to explain the work outside the
  queue.

## Verification

`src/components/orders/__tests__/dispatchQueue.test.ts` covers the queue
default, single/all selection and the count label. `tsc --noEmit` covers the
filter plumbing.
