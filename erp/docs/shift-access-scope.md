# Shift access scope (ARGUS #111)

## Problem

`shift:view` is granted to cashiers because the POS needs their own shift and
Z-report. It was also the only gate on the management shift ledger, so a
cashier could open `/staff/shifts` directly, list every tenant shift, and fetch
any shift's Z-report — including the owner's revenue and cash difference.

## Decision

Management access is the same audience the sidebar labels "Cashier Shifts":

| Caller | Scope |
| --- | --- |
| OWNER / MANAGER (or explicit `sale:view_history`) | tenant-wide ledger and any shift/Z-report |
| any other caller holding a shift capability (`shift:view`/`open`/`close`) | own shift only |
| no shift capability | `403 FORBIDDEN` |

The management pages `/staff/shifts` and `/staff/shifts/[id]` now redirect
non-management users to `/pos`. Cashiers keep opening/closing their shift and
viewing `/pos/shift-report?shiftId=<their own>`; the POS never needs the
tenant-wide ledger.

## Implementation

`src/lib/shifts/shift-access-scope.ts` (pure, unit tested):

```ts
resolveShiftAccessScope({ canAccessShifts, role, canViewSaleHistory, userId })
  -> { kind: 'tenant' } | { kind: 'own', cashierId } | { kind: 'forbidden' }
applyShiftListScope(filters, scope)          // forces cashierId for own scope
isShiftInAccessScope(scope, shift.cashierId)
```

`src/lib/shifts/shift-access-request.ts` adapts a session user to that scope
(`shift:view` / `open` / `close` for base access, `sale:view_history` +
OWNER/MANAGER for management).

Routes:

- `GET /api/store/shifts` — own scope replaces any spoofed `cashierId`.
- `GET /api/store/shifts/[id]` — own scope is part of the query, so another
  cashier's id returns `404`, not data.
- `GET /api/store/shifts/[id]/z-report` — same scoping; POS own-shift reports
  keep working.
- `GET/POST /api/store/shifts/[id]/cash-movements` — petty-cash rows are shift
  data too, so they use the same own/management rule (previously unguarded).

`getShiftById` and `buildZReportData` accept an optional `viewerCashierId` used
in the `WHERE` clause; tenant scoping is unchanged.
