# Notification row links (ARGUS #54)

The `/notifications` page and the header bell menu must open the same
destination for a row. Both used to keep a private `getNotificationHref`
switch, which drifted and left most rows without an Open button.

## One mapping

`src/lib/notifications/notification-href.ts` exports:

```ts
getNotificationHref({ type, relatedEntityId, relatedEntityType }): string | null
```

| Type | Destination |
| --- | --- |
| `SALE_COMPLETED` | `/sales/<relatedEntityId>`, else `/sales` |
| `RETURN_PROCESSED` | `/returns` (the returns ledger has no per-return page) |
| `SHIFT_CLOSED` | `/staff/shifts/<id>`, else `/staff/shifts` |
| `LOW_STOCK_ALERT` | `/stock-control/low-stock` |
| `STOCK_TAKE_SUBMITTED/APPROVED/REJECTED` | `/stock-control/stock-takes/<id>/review`, else `/stock-control/stock-takes` |
| `PETTY_CASH_LOW` | `/petty-cash` |
| `RAW_MATERIAL_LOW_STOCK` | `/factory/raw-materials?stockStatus=LOW` |
| `RAW_MATERIAL_CRITICAL` | `/factory/raw-materials?stockStatus=OUT` |
| `BATCH_EXPIRY_SOON`, `BATCH_EXPIRED` | `/inventory/batches` |
| `PACKAGING_LOW_STOCK` | `/delivery/packaging` |
| `DELIVERY_*` | `/delivery/<id>`, else `/delivery` |
| `COD_PENDING_ALERT`, `RECONCILIATION_DISCREPANCY` | `/delivery/reconciliation` |
| `SYSTEM_ALERT`, unknown | `null` — no Open button |

A voided-sale alert is still a `SALE_COMPLETED` row, so it keeps its sale link;
the page/popover add the `Voided` label from `relatedSale`.

## Safety

- Only internal paths are produced; a supplied id is `encodeURIComponent`-ed,
  so an id can never inject a scheme or host.
- Blank ids count as missing and fall back to the list page.
- Tenant scoping is unchanged: the notification row comes from the caller's
  tenant-scoped query, and every destination page scopes its own data.

The page and popover both call this helper, so a new notification type only
needs one mapping entry.
