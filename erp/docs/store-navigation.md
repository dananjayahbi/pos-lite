# Store navigation

The sidebar configuration lives in `src/lib/navigation/store-nav.ts`; the
component only renders and permission-filters it. Groups follow the operator
workflow:

1. **Overview** — Dashboard, Notifications
2. **Retail & Clinic** — POS, Sales, Returns & Refunds, Cashier Shifts, Appointments
3. **Inventory** — Products & Stock, Barcode Printing, Categories, Brands, Stock
   Control, Adjustments, Movements, Stock Takes, Low Stock, Valuation
4. **Purchases & Factory** — Purchase Orders, Suppliers, Raw Materials, BOM, Factory
5. **Delivery & Courier** — Dispatch Orders, Deliveries, Packaging, Courier
   Settings & Rates, Rate Card, Waybill Design, Recovery
6. **CRM & Marketing** — Customers, Broadcast, Promotions
7. **HR & Payroll** — Staff, Attendance, Commissions
8. **Finance & Cash** — Expenses, Petty Cash, Cash Flow, Payment Accounts,
   Courier Reconciliation
9. **Reports & Audit** — Sales & Profit Reports, Saved Reports, Audit Log
10. **Settings** — Team & Permissions, Hardware, Taxes & Store Settings, Store
    Profile, Website CMS, My Account

Individual reports (including Return Rate / Returns Analytics) remain inside the
Reports hub rather than being duplicated as top-level links.

Payroll/leave pages are not present in the app yet, so the HR group only links
the pages that exist; adding them later is a single `store-nav.ts` change.

## Sidebar header

The sidebar header is a fixed `h-16` (64 px) bar showing the tenant logo
(36 × 36 px) and business name. It deliberately matches the desktop top bar's
`h-16`, so the two bottom borders/divider meet at the same y-position across the
layout. The old uppercase role label (`OWNER`) was removed: the role is already
visible in the account menu/top bar, and dropping it gives the logo enough
vertical room at the smaller header height.

## Active item

The sidebar highlights exactly one item. `resolveActiveNavHref()` in
`store-nav.ts` matches the current `pathname` against the permission-visible
items and picks the **most specific** (longest) `href`, so a nested page such as
`/inventory/barcode-printing` highlights *Barcode Printing* and never its
`/inventory` section as well. `match: 'exact'` items (Dashboard, POS, Customers,
Settings pages, …) only light up on their own route, not on child routes.

## Verification

- `src/lib/navigation/__tests__/store-nav.test.ts` verifies group order, no empty
  groups, unique hrefs, every pre-existing route, and that nested routes resolve
  to a single most-specific item.
- `npx tsc --noEmit`
- `npx vitest run`
