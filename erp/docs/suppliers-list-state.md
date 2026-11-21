# Suppliers list has an explicit load-error state

A failed suppliers request rendered the table header plus "No suppliers found".
The page derived the empty state from `suppliers.length === 0`; React Query's
data is `undefined` on error and the fallback is `[]`, so a 500 was
indistinguishable from a genuinely empty list and offered no retry (ARGUS #234).

## Rule

`getSuppliersListState()` (`src/lib/services/supplierListState.core.ts`):

| Condition                                             | State     |
| ----------------------------------------------------- | --------- |
| first fetch in flight                                  | `loading` |
| query rejected, or parsed `{ success:false }` envelope | `error`   |
| successful response with zero rows                     | `empty`   |
| successful response with rows                          | `ready`   |

`error` wins over `empty` by construction, so the empty copy can never appear on
a failure.

## UI

- The query function now throws on a non-2xx response or a `success:false`
  envelope, which also moves React Query into its error state.
- On `error` the table is replaced by a red panel ("Failed to load suppliers.")
  with a **Retry** button wired to `refetch()`. Pagination is hidden.
- The empty message only renders for `listState === 'empty'`.

## Verification

`src/lib/services/__tests__/supplierListState.core.test.ts` covers loading,
rejected query, `success:false`, genuine empty, ready and the no-data fallback.
