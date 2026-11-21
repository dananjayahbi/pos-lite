# Expense list states and export errors (ARGUS #402)

The Expenses page only branched on `isLoading`. A failed list request fell
through to the same "No expenses found for the selected filters" row as a
successful zero-result query, with no error text and no retry. A failed export
showed only "Export failed", discarding the API's message.

## States

`src/lib/expenses/list-state.ts` classifies the query into `loading`, `error`,
`empty` or `ready`, with **error precedence**:

| Input                                   | State   |
| --------------------------------------- | ------- |
| request failed                          | error   |
| request in flight, no error             | loading |
| success with zero rows                  | empty   |
| success with rows                       | ready   |

The page renders:

- skeleton rows for `loading`;
- a "Could not load expenses" card with the API message and a **Retry** button
  for `error` (the button shows Retrying while the refetch is in flight);
- the existing empty message only for a genuine zero-row success;
- the table, summary and pagination for `ready`.

## Export

`ExpenseExportButton` now reads the error body (JSON or plain text) and shows
`Export failed (HTTP <status>): <reason>`, falling back to the status alone.
A successful download path is unchanged.

## Verification

`src/lib/expenses/__tests__/list-state.test.ts` covers loading, empty, ready,
and error-over-empty/stale/loading. `npx tsc --noEmit` covers the render and
export wiring.
