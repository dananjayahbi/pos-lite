# Low Stock card note

The dashboard Low Stock card showed `Shift open 08:24 PM` from a shift opened
over five days earlier, with no date. That was unrelated to stock and looked
current (ARGUS #46).

The card now describes the stock state through the pure
`lowStockCardSubtitle` helper: `All variants adequately stocked` at zero, or
`N variants at or below threshold`. The unused open-shift query was removed from
the dashboard data load.

## Verification

`lowStockNote.core.test.ts` covers zero, negative, one and multiple variants.
