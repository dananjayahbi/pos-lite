# Customer metrics ignore voided sales

Voiding a sale now reverses the customer's lifetime spend and visit count
(ARGUS #308). Previously `addToSpendTotal` ran once at sale creation and nothing
undid it, so voided sales kept inflating `Customer.totalSpend`, `lastPurchaseAt`,
the visits/order count, average order value, loyalty badges and broadcast
segments built from spend.

## What changes on void

Inside the void transaction:

- `Customer.totalSpend` is reduced by the voided sale's `totalAmount` via
  `netSpendAfterVoid` (never below zero, 2dp).
- `lastPurchaseAt` is recomputed from the most recent remaining `COMPLETED` sale
  (or `null` when none remain).
- The sale itself is marked `VOIDED` and stock/payment accounts are reversed as
  before.

## Metric queries

- Customer detail/list `visitCount`/`orderCount` use a filtered relation count
  (`sales where status = COMPLETED`), so voided rows no longer count as visits.
- `getPreferredCategories` only aggregates lines from `COMPLETED` sales.
- Customer analytics reports already filtered `status = COMPLETED`.

The purchase-history list still shows voided sales (with their status) so the
audit trail stays visible; only the metrics exclude them.

## Legacy data

Customers whose spend was inflated by past voids are not recalculated
retroactively; a data fix can replay `SUM(totalAmount)` of completed sales per
customer. New voids keep the metrics correct.

## Verification

`src/lib/services/__tests__/customerSpend.core.test.ts` covers subtraction,
the zero floor and precision.
