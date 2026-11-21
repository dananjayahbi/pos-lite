# Low-stock alerts from sales (ARGUS #55)

The dashboard counted 6 low variants but the inbox had no low-stock rows.
`LOW_STOCK_ALERT` was written only by manual stock adjustment and stock-take
approval; completing a sale reduced stock without producing an alert.

## One producer, one rule

`src/lib/notifications/low-stock-alert.ts` now owns:

- `selectLowStockAlerts(candidates)` - filters with `isLowStockVariant`
  (`threshold > 0 && stock <= threshold`), de-duplicates by variant and, when a
  `previousQuantity` is supplied, keeps only movements that **cross** into low
  stock;
- `createLowStockAlerts(client, tenantId, candidates, context)` - writes the
  alert for every active OWNER/MANAGER with the existing title/body shape:
  `<product> - <sku> is low on stock` /
  `Current stock: N units. Threshold: M units. <context>.`

Callers:

| Path | Context | Timing |
| --- | --- | --- |
| Manual adjustment (`adjust` route) | `Adjusted by: <staff>` | inside the transaction |
| Bulk adjustment | `Adjusted by: <staff>` | inside the transaction |
| **Completed sale** (`createSale`) | `Sold via sale <ref>` | best-effort after commit |

The sale path passes `previousQuantity` (post-sale stock + units sold), so a
variant that was already low does not generate another alert on every sale.
Manual/bulk adjustments keep their previous "alert whenever the new quantity is
low" behaviour.

The sale alert is fire-and-forget after the sale commits: a notification
failure never fails a paid sale, and the alert links to
`/stock-control/low-stock` through the existing notification href map.

## Verification

`src/lib/notifications/__tests__/low-stock-alert.test.ts` covers the crossing,
already-low, disabled-threshold, above-threshold and de-duplication cases, plus
the shared title/body.
