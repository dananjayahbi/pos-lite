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
10. **Settings** - Team & Permissions, Hardware, Taxes, Store Profile, Website CMS,
    My Account

Individual reports (including Return Rate / Returns Analytics) remain inside the
Reports hub rather than being duplicated as top-level links.

Payroll/leave pages are not present in the app yet, so the HR group only links
the pages that exist; adding them later is a single `store-nav.ts` change.

## Icons

Every `NavItem` carries its own `icon`, typed as a `LucideIcon`, and
`StoreSidebar` renders it at 16 px with a 1.75 px stroke. Operators navigate 54
entries, so the glyph is the primary recognition cue and the label is the
confirmation. The rules:

- **One icon per item, never shared.** The mapping is validated: the icon test
  in `store-nav.test.ts` fails if two items reuse the same glyph.
- **Icons are required.** `icon` is a non-optional field, so `tsc` rejects a new
  nav entry that forgets one. A separate `Record<href, icon>` map would let the
  sidebar and the data drift apart.
- **Labels never truncate silently.** Rows are fixed at `h-9`, so the label gets
  `truncate` plus a `title` with the full name; at the sidebar's 256 px width
  every current label fits.
- **Inactive icons are muted** (`text-sand-ink`) and become `text-espresso` on
  hover; the active item's icon turns `text-terracotta`, matching its 3 px left
  border.

The set comes from `lucide-react`, which is already a dependency and is imported
per icon, so only the 54 glyphs that are used reach the client bundle. Hand-drawn
SVGs were considered and rejected: they would need 54 maintained paths for no
size win over a tree-shaken library that the rest of the UI already uses, and
would drift in stroke weight from the icons shown elsewhere.

## Sidebar header

The sidebar header is a fixed `h-16` (64 px) bar showing the tenant logo
(36 × 36 px) and business name. It deliberately matches the desktop top bar's
`h-16`, so the two bottom borders/divider meet at the same y-position across the
layout. The old uppercase role label (`OWNER`) was removed: the role is already
visible in the account menu/top bar, and dropping it gives the logo enough
vertical room at the smaller header height.

Long store names are **not truncated**. The name wraps to at most two balanced
lines (`text-balance leading-tight line-clamp-2`) at the same 20 px display
size, so "Ruhunu Weda Gedara" reads in full inside the 64 px header rather than
as "Ruhunu Weda G…". The `title` attribute still exposes the full name for
unusually long values that need a third line.

## Active item

The sidebar highlights exactly one item. `resolveActiveNavHref()` in
`store-nav.ts` matches the current `pathname` against the permission-visible
items and picks the **most specific** (longest) `href`, so a nested page such as
`/inventory/barcode-printing` highlights *Barcode Printing* and never its
`/inventory` section as well. `match: 'exact'` items (Dashboard, POS, Customers,
Settings pages, …) only light up on their own route, not on child routes.

## Verification

- `src/lib/navigation/__tests__/store-nav.test.ts` verifies group order, no empty
  groups, unique hrefs, every pre-existing route, that nested routes resolve to a
  single most-specific item, and that every item has a unique icon.
- `npx tsc --noEmit`
- `npx vitest run`


## Settings labels match their pages (ARGUS #477)

The Settings group used to show `Taxes & Store Settings` while the link went
only to `/settings/taxes`; the Store Profile page had a separate entry and
neither page linked the other. The entry is now labelled **Taxes**, matching the
page, and the two pages cross-link: Taxes links to Store Profile, and Store
Profile links to Taxes for anyone with the owner-only tax permission. The
Settings hub catalog already listed `Taxes`, so the sidebar and hub agree.
