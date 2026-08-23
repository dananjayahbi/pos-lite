# 40 — Petty Cash Low-Balance Alerts

**Module:** M12 — Petty Cash Management
**Severity:** Medium
**Status:** Not implemented
**Related docs:** [36-standalone-petty-cash-fund](./36-standalone-petty-cash-fund.md), [39-petty-cash-balance-equation](./39-petty-cash-balance-equation.md)

## Issue / Current State
There is no low-balance alert or configurable threshold for petty cash. A fund (once introduced by doc 36) has no defined minimum, and the business owner is not notified when cash is running low (e.g., below Rs. 5,000).

The `NotificationType` enum in `erp/prisma/schema.prisma` has several operational types (e.g., `LOW_STOCK_ALERT`, `PACKAGING_LOW_STOCK`, `COD_PENDING_ALERT`) but no petty-cash type. There is also no check tied to expense recording or cash withdrawals, and no scheduled job scanning petty-cash balances like the packaging low-stock scan (doc 23).

## Impact
Running out of petty cash interrupts everyday operations — staff cannot make small urgent purchases or float change — and a shortfall is only discovered at the point of need. Automatic low-balance alerts would let the owner top up proactively, keeping operations smooth and preventing unreimbursed cash from staff.

## Implementation Plan
### Step 1 — Add a petty-cash notification type
Add a new value to the `NotificationType` enum in `erp/prisma/schema.prisma` (e.g., `PETTY_CASH_LOW`), and run a migration. This makes alerts first-class and filterable in any notification UI.

### Step 2 — Add a configurable threshold
Add a configurable low-balance threshold to the standalone petty-cash fund (from doc 36) — either a field on the fund model or a tenant setting. Default it to a sensible value (e.g., Rs. 5,000) and expose it for editing in the petty-cash UI.

### Step 3 — Check balance on expense/withdrawal
In the petty-cash service, after recording an expense or withdrawal, compare the resulting balance (per the equation in doc 39) against the threshold. If it drops to or below the threshold, create a `PETTY_CASH_LOW` `NotificationRecord` targeted at the owner (and optionally managers), following the existing notification creation pattern used elsewhere in the codebase.

### Step 4 — Add a scheduled scan (optional)
For resilience, add a scheduled cron job (mirroring the pattern in doc 23 and existing `erp/src/app/api/cron/` jobs) that periodically scans fund balances against thresholds and emits alerts, catching cases where the transactional check was missed.

### Step 5 — Suppress repeat alerts
Avoid alerting repeatedly for an already-low fund. Introduce a simple "last alerted" state or only re-alert when the balance crosses below the threshold again (or when it changes), so the owner is not spammed daily.

## Dependencies
- [36-standalone-petty-cash-fund](./36-standalone-petty-cash-fund.md) — provides the fund and threshold location.
- [39-petty-cash-balance-equation](./39-petty-cash-balance-equation.md) — the balance compared against the threshold.
- Existing `NotificationRecord`/`NotificationType` infrastructure and cron patterns.

## Files / Areas affected
- `erp/prisma/schema.prisma` — `NotificationType` addition, threshold field on fund + migration.
- `erp/src/lib/services/petty-cash.service.ts` — threshold check on expense/withdrawal.
- New cron route under `erp/src/app/api/cron/` for the scheduled scan (optional).
- Petty-cash UI — threshold configuration.
