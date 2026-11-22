# Return window uses the selling date (ARGUS #87)

The 30-day eligibility check used `Sale.createdAt` (the moment the row was
typed), while every report, list and the detail page use `Sale.saleDate` (the
recorded accounting date). A sale backdated by two weeks was therefore
returnable for 44 days from its selling date.

## Rule

`src/lib/sales/return-window.ts`:

```ts
saleReturnWindowStart(sale) // saleDate ?? createdAt
saleReturnWindowEnd(sale)   // start + 30 days
isReturnWindowExpired(sale, now?)
```

- `saleDate` set -> the window starts on the recorded selling date/time.
- `saleDate` null (legacy rows) -> `createdAt`, matching
  `src/lib/reports/accounting.ts`.
- The current instant is still the comparison point; the boundary instant is
  not expired (same inclusive behaviour as before).

Both callers share the helper:

- `validateReturnEligibility` in `src/lib/services/return.service.ts` (the
  server-side authority);
- the return button in `SaleHistoryTable` (the UI hint/tooltip).

## Verification

`src/lib/sales/__tests__/return-window.test.ts` covers a backdated sale, the
legacy fallback, ISO strings from the list API and the boundary instant.
