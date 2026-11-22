# Sales payment filter is server-side

The Sales ledger filtered the payment method in the browser on the current
20-row page. Last Month had 27 sales; selecting Cash left 11 rows on page 1 and
3 on page 2 while the footer still said "Page 1 of 2 (27 sales)" (ARGUS #77).

## Fix

`GET /api/store/sales` accepts `paymentMethod` (validated against the
`PaymentMethod` enum). `getSales` applies it to the Prisma `where` before
`skip`/`take` and the `count`, so rows, `meta.total` and `totalPages` describe the
filtered set. The payment select invalidates the query with the method in its
key and resets to page 1; the in-browser `filter` was removed.

An unknown method is ignored (treated as no filter) rather than leaking an
invalid enum into Prisma.

## Verification

`tsc` plus the existing sales list tests cover the query shape; the filter is a
straight Prisma equality on an indexed/filterable column.
