# Expenses: filtered totals, search and form defaults

ARGUS #404. The register's only total was "Total (this page)", so a filtered
period spanning more than 20 rows had no grand total and no matching count.
There was no description search, the create form seeded `Amount = 0` even
though the schema requires `0.01`, and the edit dialog could render
"Select account" for an expense whose fund account was no longer in the active
account list.

## Contract

- `GET /api/store/expenses` also runs an aggregate over the same filter and
  returns `totalAmount` (sum of every matching row) alongside `total`.
- `search` is a trimmed, 100-character-bounded, case-insensitive description
  filter. `GET /api/store/expenses/export` accepts the same parameter so the
  CSV matches what the operator sees.
- The page shows `N expenses matching the filters` and `Filtered total`, plus a
  debounced search input (300 ms) and an Amount field that starts empty with a
  `0.01` placeholder.
- `AccountSelect` accepts `fallbackOption`, so a saved account id that is not in
  the loaded options still displays its name instead of the placeholder.
- `src/lib/expenses/filter.ts` owns search normalization and the where-builder
  (category + search + inclusive date range).

## Verification

- `src/lib/expenses/__tests__/filter.test.ts`
- `npx tsc --noEmit`
