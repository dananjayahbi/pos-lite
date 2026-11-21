# Packaging list load errors

A failed `GET /api/store/packaging` rendered the same "No packaging items yet"
empty state as a successful zero-row response, with no retry, so an outage
looked like an empty inventory (ARGUS #284).

## Behaviour

- `resolvePackagingListState` (`components/delivery/packaging/packagingListState.ts`)
  derives `loading | error | empty | ready`. Error wins over any stale cached
  rows, matching the shared rate-card load-state pattern.
- The error state renders an alert with the failure message and a Retry button
  that refetches the list; it is visually and textually distinct from the empty
  state.
- Only a successful response with zero rows reaches the empty state.
- The old duplicate bottom-of-page empty message was removed, so one state
  renders one explanation.
- The consumption history card keeps its own independent error/retry state.

## Verification

`packagingListState.test.ts` covers loading, error with stale rows, a successful
empty response and ready.
