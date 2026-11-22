# COD reconciliation: import result summary and history

Every remittance upload toasted "Remittance statement imported", even when the
statement matched zero ledger rows. Unmatched rows were discarded and the page
kept no import history (ARGUS #512).

## Storage

`StatementImport.rawRows` is already a JSON column, so no migration was needed.
A completed import now stores:

```json
{ "rows": [ /* raw parsed rows, as before */ ],
  "unmatched": [ { "waybill": "...", "orderRef": "...", "amount": "1000.00" } ] }
```

Legacy rows that stored a plain array still summarise: unmatched is derived as
`rowCount - matchedCount - discrepancyCount` (never negative). The API never
exposes raw rows, only the normalised unmatched list.

## API and UI

- `POST /api/store/reconciliation/import` keeps the existing
  `data.{id,status,rowCount,matchedCount,discrepancyCount}` fields and adds
  `unmatchedCount` plus `unmatched[]`.
- `GET /api/store/reconciliation` adds `imports` (latest 25): filename, status,
  counts, `unmatchedCount`, unmatched detail, parse error and timestamps.
- The upload hook now toasts the real result
  (`N rows read, M matched, D discrepancies, U unmatched`).
- The page renders an **Import history** card with the latest result summary,
  each recent import, FAILED parse errors, and an expandable unmatched-rows
  table. A zero-match import is therefore visible instead of silent.

## Verification

`src/lib/services/__tests__/reconciliation-import.core.test.ts` covers the
structured and legacy rawRows shapes, zero-match imports, count clamping,
unmatched normalisation and the toast copy.
