# Customer list and detail load errors

A failed customer request was presented as real data: a 500 (or 403) on
`GET /api/store/customers` rendered the same empty table as a successful
zero-row response, with no retry, and every detail failure rendered "Customer
not found" whether the status was 404, 403 or 500 (ARGUS #313).

## List

`resolveCustomerListState` (`src/lib/services/customerLoad.core.ts`) resolves the
list to exactly one state:

- `loading` - first request in flight
- `error` - the request failed; wins over any stale cached rows
- `empty` - a successful response with zero rows
- `ready` - a successful response with rows

The page renders skeleton rows for `loading`, a `role="alert"` block with the API
message and a `Retry` button for `error`, "No customers found" only for `empty`,
and the table only for `ready`. While the list is in `error`, the repeat-buyer
count badge and pagination are hidden (they would otherwise show stale totals or
offer navigation through rows that are not on screen).

The React Query function now throws a `CustomerLoadError` carrying the HTTP
status and the API envelope message, so a 403 reads as a permission failure and a
500 reads as a load failure instead of an empty directory.

## Detail

`resolveCustomerDetailState` returns `loading | not-found | error | ready`:

- only an HTTP **404** becomes `not-found` ("Customer not found" plus a link back
  to the list);
- 401/403/500/502/network failures become `error`, with the message and a
  `Retry` button that calls `refetch`;
- a successful response without data falls back to `not-found`.

The detail query disables React Query's automatic retries (`retry: false`) so the
explicit 404/error state is not delayed.

Tests: `src/lib/services/__tests__/customerLoad.core.test.ts` covers error over
stale rows, error over cached detail data, the 404/403/500 split and unknown
statuses.
