# Store navigation

The sidebar configuration lives in `src/lib/navigation/store-nav.ts`; the
component only renders and permission-filters it. Groups follow the operator
workflow:

1. **Overview** — Dashboard, Notifications
2. **Retail & Clinic** — POS, Sales, Returns & Refunds, Cashier Shifts, Appointments
3. **Inventory** — Products & Stock, Categories, Brands, Stock Control, Adjustments,
   Movements, Stock Takes, Low Stock, Valuation
4. **Purchases & Factory** — Purchase Orders, Suppliers, Raw Materials, BOM, Factory
5. **Delivery & Courier** — Dispatch Orders, Deliveries, Packaging, Courier
   Settings & Rates, Rate Card, Label Design, Recovery
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

## Verification

- `src/lib/navigation/__tests__/store-nav.test.ts` verifies group order, no empty
  groups, unique hrefs, and that every pre-existing route is still present.
- `npx tsc --noEmit`
- `npx vitest run`
