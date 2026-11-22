# Commission report page permission gate (ARGUS #364)

## Problem

`/staff/commissions` rendered for every authenticated store user. Cashiers got
a 403 from the summary and payout-history APIs, but the page still painted:

- Open liability Rs 0.00
- "No commission data for this period."
- "No payouts recorded..."

There was no permission notice or redirect even though both APIs require
`staff:view` or `staff:manage`.

## Rule

> Superseded by ARGUS #368: commission reports now require `payroll:view`, not
> the staff-directory permissions described below. See
> `commission-report-payroll-permission.md`.

`src/lib/services/commission-report-access.core.ts` is pure and unit tested:

```ts
canViewCommissionReports(user)
  -> hasPermission(user, staff:view) || hasPermission(user, staff:manage)
```

This is exactly the rule used by:

- `GET /api/store/staff/commissions` (view OR manage)
- `GET /api/store/staff/commissions/payouts` (manage)

The page is now a server component:

1. unauthenticated/tenantless sessions use `denialRouteFor`;
2. users without the commission-report permission are redirected to
   `/dashboard`;
3. only then does the client report component mount.

Page metadata is set server-side. The client component retained all existing
loading/error/empty/ready behaviour from ARGUS #363.

## Verified cases

- OWNER and MANAGER are allowed by their role defaults.
- CASHIER is denied.
- An explicit `staff:view` permission override allows a cashier.
- A null session is denied.

No schema or migration change is involved.
