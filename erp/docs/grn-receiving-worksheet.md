# GRN receiving worksheet

The Receive Goods page (`/suppliers/purchase-orders/[poId]/receive`) renders
`GoodsReceivingForm`, including the optional per-line batch/expiry capture from
`GrnBatchFields`.

## Batch / expiry layout

The worksheet column is narrow, and a native `<input type="date">` has an
intrinsic minimum width. The batch-number and expiry fields were previously
side-by-side in a two-column grid, which let the date input spill over the
neighbouring column and collide with its label.

They are now stacked (batch number above expiry) inside a fixed-width column,
and both inputs use `w-full min-w-0`. The table still scrolls horizontally on
small screens, but the fields no longer overlap.

## Contract

- `batchNumber` is trimmed and capped at 100 characters client-side; blank
  values are omitted so non-tracked lines keep the pre-existing payload.
- `expiryDate` is a local `YYYY-MM-DD` date input; it is anchored to UTC
  midnight and sent as an ISO timestamp only when the user picked a date.
- `thisQty` remains clamped to the remaining quantity.

## Verification

- `npx tsc --noEmit`
- `npx vitest run`
- Manual: open a SENT/partially received PO, confirm the batch and expiry
  inputs are clearly stacked and do not overlap at narrow widths.
