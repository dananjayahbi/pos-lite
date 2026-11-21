# Per-delivery packaging selection

Every `autoDeduct` item was consumed on every parcel, regardless of what the
order contained or which packaging was actually used (ARGUS #283). Auto-deduct
is now a default suggestion that the dispatcher confirms or edits per delivery.

## Behaviour

- `POST /api/store/deliveries/[id]/dispatch` accepts `packagingItemIds`.
  - omitted: the service keeps the legacy auto-deduct suggestion (older callers)
  - `[]`: consume no packaging for this parcel
  - a list: consume exactly those items, each at its configured per-parcel rate
- Ids are validated against the tenant's live packaging items inside the
  deduction path; a stale/foreign id fails with `PACKAGING_ITEM_NOT_FOUND`
  instead of silently consuming an unrelated item.
- The same list drives both the shortfall preflight (ARGUS #282) and the actual
  in-transaction deduction, so the confirmation and the write cannot diverge.
- The dispatch sheet loads `GET /api/store/deliveries/packaging-options`
  (dispatch permission, not packaging-management), preselects the auto-deduct
  items, and shows each item's stock, configured rate and the selected
  per-parcel total. Unchecking an item removes it from this dispatch only.
- Auto-deduct item settings are unchanged; they remain the default every time
  the sheet opens.

No schema change was required: `PackagingConsumption` already stores one row per
parcel + item, and the selection is request-scoped.

Pure helpers (`suggestedPackagingItemIds`, `togglePackagingItemId`,
`packagingSelectionTotals`) live in `lib/packaging/packagingSelection.core.ts`.

## Verification

`packagingSelection.core.test.ts` covers the default suggestion, add/remove,
option ordering, the selected total, a missing rate (defaults to one unit) and
an explicit empty selection.
