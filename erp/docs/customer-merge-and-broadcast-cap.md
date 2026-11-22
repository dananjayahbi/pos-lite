# Customers: merge, sales disclosure and broadcast cap

ARGUS #320. The `customer:merge` permission existed but no route or UI did,
despite live duplicate/typo records. The detail page showed the latest 20 sales
with no "showing 20 of N" notice, and `/api/broadcast/send` had no recipient cap
(the legacy route did).

## Merge

- `POST /api/store/customers/merge` (`{ primaryId, duplicateId }`) requires
  `customer:merge`, resolves both ids with the tenant filter, and rejects the
  same id twice with a typed 400/404.
- `mergeCustomers` re-points sales, appointments, shipping addresses,
  deliveries and birthday logs at the primary; folds store credit, lifetime
  spend, tags (case-insensitive union), missing profile fields and the latest
  purchase date; then soft-deletes the duplicate. The duplicate's phone stays
  reserved by the tenant-unique constraint.
- It writes `CUSTOMER_MERGED` with the duplicate snapshot and the moved-sale
  count. `buildCustomerMergePlan`/`mergeCustomerIdsError` are pure and tested.
- The detail page has a **Merge** button (permission-gated) opening
  `CustomerMergeDialog`, which searches customers, excludes the current one and
  posts the merge.

## Presentation / broadcast

- The Purchases tab shows "Showing 20 of N completed sales (latest first)" when
  the API returns fewer rows than `visitCount`.
- `BROADCAST_MAX_RECIPIENTS = 200`; `/api/broadcast/send` returns
  `422 TOO_MANY_RECIPIENTS` before creating a record or scheduling dispatch.

## Verification

- `src/lib/services/__tests__/customerMerge.core.test.ts`
- `src/lib/services/__tests__/broadcastAudience.core.test.ts`
- `tests/05_customers.spec.ts` M1 (merge flow)
