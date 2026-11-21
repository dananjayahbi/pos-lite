# Sales date basis and ordering (ARGUS #82)

The ledger and the detail surfaces previously mixed two dates:

- list + modal: accounting **date** paired with the **entry** time, sorted by
  `createdAt`;
- detail page: the accounting timestamp (12:00 for a backdated sale).

A backdated sale therefore appeared between newer rows in the list, and the
same sale showed different times by surface.

## Rule

- The row is sorted by the accounting date: `saleDate` when present, otherwise
  `createdAt`. `getSales` orders by `saleDate DESC NULLS LAST`, then
  `createdAt DESC` for legacy rows.
- The list shows the accounting date and a second line explicitly labelled
  **Entered HH:mm** from `createdAt`.
- The modal and detail page use the same accounting timestamp; the modal also
  labels the entry time.
- The detail page's field is labelled **Selling date**.

## Verification

UI/query-only change. `npx tsc --noEmit` plus the nearest sales component test
(`src/components/sales/__tests__/saleDisplay.test.ts`) pass.
