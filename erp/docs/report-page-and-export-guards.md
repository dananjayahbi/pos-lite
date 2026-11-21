# Report page and export guards (ARGUS #438)

The P&L and Sales report pages were client-only. Their APIs required
`report:view_profit` / `report:view_sales`, but a direct visitor still received
the page shell, Export and Save controls, and `report:export` was never checked.
The sidebar's single P&L link also required `report:view_sales`.

## Rule

- `/reports/profit-loss` is now a server component that redirects unless the
  session has `report:view_profit`.
- `/reports/sales` is now a server component that redirects unless the session
  has `report:view_sales`.
- `reportPagePermission` / `canViewReportPage` in
  `src/lib/reports/reportAccess.ts` document the mapping.
- Export and Save Report are hidden unless `report:export` is held. The
  client handler also refuses to run without it.
- `POST /api/reports/saved` (generates/uploads an artifact) and
  `GET /api/reports/saved/[id]/download` now require `report:export`.
- The sidebar P&L entry is labelled **Profit & Loss** and requires
  `report:view_profit`.

## Verification

`reportAccess.test.ts` checks the page-permission mapping, view checks,
`report:export` separation, and the sidebar permission. Existing report page
and nav tests still pass.

## Residual

Other report pages remain client-only; the same guard pattern should be applied
to them in a dedicated pass. Saved-report listing/deletion still uses
`report:view_sales`, which is a read/cleanup operation rather than an export.
