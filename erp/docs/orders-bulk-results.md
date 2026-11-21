# Dispatch Orders bulk results

ARGUS #265. Bulk status changes and "Prepare for delivery" return one result
per order id: `{ id, ok, message? }`. A request can therefore succeed at the
HTTP level while individual rows are rejected, for example:

- `Invalid status transition`
- `Cannot prepare order in DELIVERED`
- `Already ready for delivery`
- `Dispatch the delivery first`

## Reporting

`src/components/orders/bulkResult.ts` turns the per-id results into a summary
(`okCount`, `failedCount`, de-duplicated reasons, all-failed/partial flags) and
a toast:

- all succeeded: success toast with the count
- some succeeded: warning toast with `N of M` and the failure reasons
- none succeeded: error toast, no success wording
- empty server result: error toast

The hook (`useBulkStatusChange`, `useBulkCreateDelivery`) uses the same helper,
so both actions report failures consistently.

## Selection and dialogs

- Successful ids leave the selection; failed ids stay selected for a retry.
- The bulk status dialog stays open when every row failed, so the operator can
  pick a different status or cancel.
- When at least one row succeeds the dialog closes, and failures remain
  selected for follow-up.

`src/components/orders/__tests__/bulkResult.test.ts` covers all-success,
all-failure, partial, empty and de-duplicated-reason cases.
