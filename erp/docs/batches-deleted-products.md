# Batches of deleted products

The only batch in the tenant (`MFG-20261101-M4ICB8PU`, 3 units) belonged to a QA
product deleted on 1 Nov. It was counted as **Healthy 1**, showed no live product
link, and its quantity could not reconcile with the variant's last stock
(ARGUS #148).

## Fix

Batch lists, the batch stats/health counts and the expiry alerts now only consider
batches whose variant **and** product are not soft-deleted
(`deletedAt: null`). The rows are not deleted: restoring the product restores its
batch visibility, and the raw rows remain for audit.

This is a read-side filter, so no data migration or destructive change is
required.

## Verification

`tsc` covers the query shape. The filter uses the existing relation to
`ProductVariant`/`Product`; restoring a product makes its batches visible again.
