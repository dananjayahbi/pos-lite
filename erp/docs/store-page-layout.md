# Store page layout

Pages under `src/app/(store)` render inside the scrollable `<main id="main-content">`
column created by `StoreLayoutClient`.

## Rules

- Use `className="space-y-6 p-6"` on the page wrapper so content fills the
  available width, matching Inventory, Categories, Suppliers, etc.
- Do **not** add `mx-auto` / `max-w-*` to a general store page. Those utilities
  are reserved for intentionally narrow surfaces (settings forms, import
  flows, printable shift reports) where a constrained reading width is part of
  the design.
- Tables and dashboards should stretch edge-to-edge inside the `p-6` gutter;
  use internal grid columns for density instead of narrowing the page.

## Promotions

`src/app/(store)/promotions/page.tsx` previously used
`p-6 max-w-6xl mx-auto`, which produced large left/right gutters on wide
monitors. It now uses the standard full-width wrapper. Regression coverage lives
in `tests/15_promotions_pricing.spec.ts` (F10), which compares the page wrapper
width with the `main` column.

## Payroll

`/payroll` (Run Payroll) and `/payroll/reports` (Payroll Reports & Bank
Sheets) previously used `PageContainer maxWidth="7xl"`, which centered a
1280px column and left wide empty gutters on large monitors. Both now use the
default full-width `PageContainer` with `space-y-6`, matching the rest of the
store pages.

## Factory pages

`/factory/bom` previously rendered its wrapper without any padding, so the
heading, table and actions touched the sidebar/top edges. It now uses
`space-y-4 p-6`. `/factory/raw-materials` had the same problem and now uses
`space-y-6 p-6`, and `/factory` (dashboard) now uses `space-y-6 p-6`.
Regression coverage lives in `tests/22_factory_bom.spec.ts` (T7) and
`tests/21_factory_raw_materials.spec.ts` (T7 raw materials, T8 dashboard), which
check the computed padding and the heading offset from the `main` column.
