# Dispatch Orders load errors

ARGUS #267. A failed order-list request (for example a 403 from the
`viewDelivery` permission check, or a network error) previously rendered the
same "No orders found." message as a successful empty result, with no retry.

## States

`src/components/orders/listState.ts` resolves the list to one state:

- `loading` - first request in flight
- `error` - the request failed; wins over cached/stale rows
- `empty` - a successful response with zero rows
- `ready` - a successful response with rows

The page renders exactly one of these:

- skeleton for `loading`
- red alert with the API message and a `Retry` button for `error`
- "No orders found." only for `empty`
- the table only for `ready`

While the list is in `error`, the bulk action bar and pagination are hidden so
stale rows cannot be acted on. `Retry` calls the React Query `refetch` and is
disabled while a retry is in flight.

Tests: `src/components/orders/__tests__/listState.test.ts`, including the case
where a failed query still has cached rows and the case where it has none.
