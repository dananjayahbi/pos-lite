# Delivery detail load states

ARGUS #273. The detail page treated every missing/failed request as "Delivery
not found" after rendering a blank header, and offered no retry for a 403 or
500.

## States

`src/components/delivery/detailLoadState.ts` resolves one state:

- `loading` - initial request in flight
- `not-found` - only for an HTTP 404 (or a successful response with no record)
- `error` - 403, 500, other HTTP failures and network failures; retryable
- `ready` - delivery loaded

The retryable error state shows the API message and a `Retry` button that calls
React Query `refetch`. It never renders the "Delivery not found" copy, so a
permission or server outage is not mistaken for a deleted order.

`useDelivery` now throws `DeliveryLoadError` with the HTTP status and disables
React Query's automatic retries so the explicit state appears immediately.

The header shows `Loading delivery...` while loading instead of a blank title.

Tests: `src/components/delivery/__tests__/detailLoadState.test.ts` covers
loading, 404, 403, 500, network failure and ready.
