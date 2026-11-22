# Stock adjustments revalidate the storefront (ARGUS #195)

Storefront product pages and catalog availability are cached with Next.js ISR
and fetch tags. Product create/update routes already call
`revalidateTenantStorefront` after a mutation; the manual adjustment routes did
not, so website stock stayed stale until the revalidation window expired.

## Behaviour

Both adjustment routes now call the existing helper after the stock change and
its audit/webhook side effects have committed:

- `POST /api/store/stock-control/adjust` revalidates the adjusted product.
- `POST /api/store/stock-control/bulk-adjust` revalidates every distinct
  product touched by the batch (several variants can share a product).
- Both pass `catalog: true`, so category/brand availability filters are purged
  along with the product pages.

The argument normalization lives in
`src/lib/website/storefront-revalidation.core.ts`
(`stockAdjustmentRevalidationOptions`): it deduplicates ids, drops blanks and
keeps first-seen order.

Revalidation follows the product create/update pattern: failures are caught and
logged with `console.warn` and never fail the adjustment response. The stock
change is already committed at that point.

Tests: `src/lib/website/__tests__/storefront-revalidation.test.ts`.
