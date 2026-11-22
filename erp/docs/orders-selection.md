# Dispatch Orders selection

ARGUS #264. The Dispatch Orders page (`/orders`) lets staff select rows and run
bulk status changes, delivery preparation, waybill printing and invoice
printing. Only rows the operator can see may be acted on.

## Rules

- Search, status and page changes clear the selection.
- The selection is intersected with the rows currently rendered. A refetch can
  remove rows without a filter change (for example, another staff member moved
  an order), so hidden ids are dropped when the row data changes.
- Every bulk action uses the same visible selection:
  - bulk status change
  - prepare for delivery
  - bulk waybill print
  - bulk invoice print
  - the "N selected" count and the bulk status dialog count
- The page-level checkbox selects only the current page. It never re-selects
  ids remembered from another page.

## Implementation

`src/components/orders/selection.ts` contains the pure helpers
(`visibleSelectedIds`, `pruneSelection`, `toggleSelection`, `toggleAllVisible`)
and `src/components/orders/__tests__/selection.test.ts` covers hidden ids,
display order and the page toggle.

`OrdersPageClient` derives `selectedVisibleIds` and `selectedOrders` from those
helpers; handlers no longer read the raw selection set directly.
