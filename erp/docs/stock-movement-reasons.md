# Stock movement reasons are one shared config (ARGUS #183)

The `StockMovementReason` enum in `prisma/schema.prisma` has 13 members. The
Movement History page previously kept its own 11-entry chip list and two partial
label maps, so `MANUFACTURED` and `WEBSITE_ORDER` movements had no chip, rendered
as raw enum tokens, and exported a raw `Reason Label`.

## Source of truth

`src/lib/constants/stock-movement.ts` now owns:

- `STOCK_MOVEMENT_REASONS` - all 13 members in schema order.
- `STOCK_MOVEMENT_REASON_LABELS` - display and CSV labels for every member.
- `STOCK_MOVEMENT_REASON_BADGE_VARIANT` / `STOCK_MOVEMENT_REASON_DOT_COLOR` -
  the badge and chip-dot styling.
- `parseStockMovementReasons`, `serializeStockMovementReasons` and
  `toggleStockMovementReason` - the `?reasons=` URL contract.

The Movement History page (`StockMovementHistory.tsx`), the Stock Control
dashboard badge and the movements API/CSV export all read this module. Unknown
tokens fall back to the raw value, so a future enum member stays readable instead
of rendering blank.

## Filter behaviour

- No `reasons` param means every reason (the default feed).
- Values are parsed against the shared list; unknown tokens are ignored and the
  canonical order is restored.
- The pills compare against the full 13-reason set, so `Showing 1 of 13 reasons`
  is accurate.
- Toggling a chip from the default starts from all 13 reasons. Deselecting one
  therefore builds a 12-reason include list and cannot silently drop the newer
  enum members from the filter.

Tests: `src/lib/constants/__tests__/stock-movement.test.ts`.
