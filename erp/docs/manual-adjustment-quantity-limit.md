# Manual adjustment quantity ceiling

ARGUS #190.

The API caps a manual adjustment delta at `MAX_STOCK_ADJUSTMENT_DELTA`
(1,000,000 units). The form's quantity input only had `min={1}`, and its zod
schema had no maximum, so a typo above the cap was accepted client-side and
rejected only after a server round-trip. Values above 999 showed a "double
check" warning but stayed submittable.

- The form schema now uses `.max(MAX_STOCK_ADJUSTMENT_DELTA)` with the same
  message the API's range validation produces, imported from
  `src/lib/validators/product.validators.ts` so the two bounds cannot drift.
- The input exposes `max`/`step={1}` for keyboard and spinner users.
- The existing `> 999` double-check hint remains for large-but-valid values.

The server remains authoritative: `StockAdjustmentSchema` still rejects a
zero, fractional or out-of-range delta, the route re-checks the resulting stock
against the int4 ceiling, and tenant/permission/reason guards are unchanged.
