# 36 — Standalone Petty Cash Fund & Opening Balance

**Module:** M12 — Petty Cash Management
**Severity:** High
**Status:** Not implemented
**Related docs:** [39-petty-cash-balance-equation](./39-petty-cash-balance-equation.md), [40-petty-cash-low-alerts](./40-petty-cash-low-alerts.md), [41-petty-cash-export](./41-petty-cash-export.md), [37-petty-cash-categories](./37-petty-cash-categories.md), [38-receipt-upload](./38-receipt-upload.md)

## Issue / Current State
Petty cash is entirely shift-bound. The `CashMovement` model (`erp/prisma/schema.prisma`) requires a non-null `shiftId` and records `OPENING_FLOAT`, `PETTY_CASH_OUT`, `MANUAL_IN`, and `MANUAL_OUT` movement types, all scoped to a POS shift. The UI in `erp/src/components/shift/PettyCashSection.tsx` (and `RecordCashMovementForm.tsx`) is invoked with a specific `shiftId` and queries cash movements per shift.

There is no concept of a standalone petty-cash fund with a configurable opening balance (e.g., Rs. 30,000) that persists independently of POS shifts. An owner cannot allocate a fixed float once and track it across days, shifts, and expense loggings.

## Impact
Because petty cash resets/reconstitutes per shift, there is no single fund the owner can hold accountable. Expenses logged between or outside shifts are hard to attribute to a stable balance, undermining day-to-day cash control. A fixed, configurable float is the foundation every other petty-cash feature (balance equation, alerts, export) depends on.

## Implementation Plan
### Step 1 — Introduce a standalone petty-cash fund model
Add a new model (e.g., `PettyCashFund`) in `erp/prisma/schema.prisma`, tenant-scoped, holding the configured opening/allocation balance (Decimal), a current balance (or derive it), a name/currency field if needed, and timestamps. Optionally associate it with the tenant so one fund exists per store. Keep `CashMovement` intact for shift-level activity; the fund represents the standalone float.

### Step 2 — Add a fund service and API
Create a service (e.g., `erp/src/lib/services/petty-cash.service.ts`) with functions to get/initialize the fund, set the opening balance, and record standalone deposits/withdrawals against the fund. Add API routes (e.g., under `erp/src/app/api/store/petty-cash/`) for reading the fund and updating the opening balance, following the existing route/service conventions used by shifts.

### Step 3 — Build a standalone petty-cash UI section
Create a page/component (e.g., under `erp/src/app/(store)/petty-cash/` or within the expenses area) that is **not** shift-scoped. It should display the fund's opening balance and current balance, let the owner set/edit the initial allocation, and record standalone petty-cash transactions. Keep the existing `PettyCashSection.tsx` for in-shift floats, and link/separate them clearly in the UI.

### Step 4 — Wire expenses to the fund
Ensure standalone expenses (from the expenses module) can be attributed to this fund so the balance equation (doc 39) can subtract logged expenses from the initial allocation. This may be a lightweight linkage (e.g., expenses reference the fund, or the fund aggregates expenses by date range).

## Dependencies
- [39-petty-cash-balance-equation](./39-petty-cash-balance-equation.md) — consumes the fund's initial allocation and expense totals.
- [40-petty-cash-low-alerts](./40-petty-cash-low-alerts.md), [41-petty-cash-export](./41-petty-cash-export.md), [37-petty-cash-categories](./37-petty-cash-categories.md), [38-receipt-upload](./38-receipt-upload.md) — all build on the standalone fund.
- Existing `CashMovement` model and shift cash-movement plumbing as reference.

## Files / Areas affected
- `erp/prisma/schema.prisma` — new `PettyCashFund` model + migration.
- New service `erp/src/lib/services/petty-cash.service.ts`.
- New API routes under `erp/src/app/api/store/petty-cash/`.
- New standalone petty-cash UI page/component (not shift-scoped).
- `erp/src/components/shift/PettyCashSection.tsx` — remains for shift floats, possibly refactored to share rendering.
