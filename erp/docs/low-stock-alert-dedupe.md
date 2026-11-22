# Low-stock alert deduplication

ARGUS #197.

Every adjustment that landed at or below the threshold wrote a fresh
`LOW_STOCK_ALERT` for every active OWNER and MANAGER. Repeated corrections
around the threshold therefore produced duplicate inbox entries.

`createLowStockAlerts` now:

1. selects the variants that genuinely need an alert (existing crossing rule);
2. looks up **unread** alerts for those variants for the tenant
   (`type = LOW_STOCK_ALERT`, `relatedEntityType = ProductVariant`);
3. writes only the missing `(recipient, variant)` pairs via
   `filterNewLowStockAlerts`.

Consequences:

- one active alert per variant/recipient episode;
- once a recipient reads the alert, a later qualifying crossing can notify
  again (a new episode);
- the suppression is tenant-scoped and never crosses variants;
- the writer stays in the caller's transaction, so the check and the insert see
  the same inbox state.

The pure pair filter is unit tested.
