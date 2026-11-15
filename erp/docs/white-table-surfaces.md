# White table surfaces (UI update #6)

Tables previously inherited the pearl page background (`#F1EDE6`), which made
dense data grids blend into the page. Every `<table>` now renders on a white
surface (`#FFFFFF`).

## Implementation

A single base rule in `src/app/globals.css`:

```css
@layer base {
  table {
    background-color: #ffffff;
  }
}
```

It covers both the shared shadcn `Table` component
(`src/components/ui/table.tsx`) and the hand-written `<table>` elements still
used by a few modules (audit log detail, batches, imports, reconciliation, POS
shift report, invoices), without touching 26 page files.

Because the rule lives in Tailwind's base layer, row and header utilities
(`bg-linen/40`, `bg-sand/20`, `bg-muted`, `hover:bg-muted/50`, selected rows,
etc.) still win — only the table's own transparent background changes.

Print documents that use a `<table>` (order invoice) are unaffected visually:
they were already on white paper, and the background is now explicit.

## Pages

The requested pages, all of which render one or more tables (unless noted):

`/appointments/list`, `/appointments/services`, `/inventory`, `/stock-control`,
`/stock-control/movements`, `/suppliers/purchase-orders`, `/orders`,
`/delivery`, `/delivery/packaging`, `/delivery/settings`, `/delivery/rate-card`,
`/customers/broadcast`, `/promotions`, `/staff/timeclock`,
`/staff/commissions`, `/payroll`, `/payroll/reports`, `/expenses`,
`/petty-cash`, `/expenses/cash-flow`, `/payment-accounts`,
`/delivery/reconciliation`, `/reports`, `/reports/saved`,
`/settings/audit-log`, `/settings/users`.

Pages that currently show only cards/empty states (no `<table>` at load) are
naturally covered if a table appears later — for example the reconciliation
ledger once entries exist, or a report table after a period is selected.

## Test

`tests/39_table_surfaces.spec.ts` logs in as the owner, visits every listed URL,
and for each page that has a table asserts the computed background colour of
**every** table is `rgb(255, 255, 255)`. It also requires at least 15 of the
listed pages to actually render a table, so a CSS/import regression cannot pass
by making every page table-free.
