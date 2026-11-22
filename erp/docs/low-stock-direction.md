# Low-stock alerts and adjustment direction

ARGUS #217.

The manual and bulk adjustment routes passed only the resulting quantity to the
shared low-stock producer, so the direction was lost. Adding one unit to a
variant at 4 with a threshold of 5 (`4 → 5`) therefore sent "is low on stock" to
every owner and manager, even though stock rose and the variant was already
low.

- Both routes now send `previousQuantity` (the quantity before that row's
  delta).
- `selectLowStockAlerts` only selects a **downward crossing** into the
  threshold; an upward move or a move that was already at/below does not alert.
- The single route's `lowStockTriggered` flag (which drives the warning toast)
  now comes from the same selection, so the UI does not claim a notification
  that was not written.
- The bulk route's `lowStockTriggeredVariantIds` is built from the selected
  candidates, not from a raw `<= threshold` check.

Combined with the unread-alert dedupe (ARGUS #197), a restock that lands on the
threshold sends nothing.
