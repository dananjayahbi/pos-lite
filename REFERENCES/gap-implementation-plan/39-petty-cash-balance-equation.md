# 39 — Petty Cash Balance Equation

**Module:** M12 — Petty Cash Management
**Severity:** High
**Status:** Not implemented
**Related docs:** [36-standalone-petty-cash-fund](./36-standalone-petty-cash-fund.md), [40-petty-cash-low-alerts](./40-petty-cash-low-alerts.md), [41-petty-cash-export](./41-petty-cash-export.md)

## Issue / Current State
The current petty-cash display does not reflect a true fund balance. `PettyCashSection.tsx` (`erp/src/components/shift/PettyCashSection.tsx`) computes only a shift-scoped net of cash movements — it filters out the `OPENING_FLOAT` type when summing and does not consider logged `Expense` records at all. There is no explicit "Initial Allocation − Total Logged Expenses = Remaining Balance" equation, and no standalone fund (from doc 36) to anchor it.

As a result, the number a user sees is a per-shift movement net, not the accountable balance of a petty-cash fund after expenses.

## Impact
Without a clear, auditable balance equation, the owner cannot tell whether petty cash is where it should be. Cash shortfalls or overages go unnoticed until they compound, and reconciling fund allocations against logged expenses is manual guesswork. A transparent equation is the core control for petty-cash integrity and is a prerequisite for reliable low-balance alerts (doc 40) and exports (doc 41).

## Implementation Plan
### Step 1 — Implement the balance computation in the service
In the petty-cash service introduced by doc 36 (e.g., `erp/src/lib/services/petty-cash.service.ts`), add a function that computes the fund balance as: **Initial Allocation − Total Logged Expenses** (plus any standalone deposits, minus standalone withdrawals). Total logged expenses should sum `Expense.amount` for the relevant fund/date range. Return the components (initial allocation, total expenses, current balance) so the UI can display the full equation.

### Step 2 — Expose the equation via API
Add an API endpoint (under `erp/src/app/api/store/petty-cash/`) that returns the fund balance components. Reuse the existing expense query used elsewhere so the total expense figure stays consistent with what is shown in the expenses module.

### Step 3 — Display the equation in the UI
Update the standalone petty-cash UI from doc 36 to render the equation explicitly (e.g., "Opening: Rs. 30,000 − Expenses: Rs. 12,500 = Balance: Rs. 17,500"), not just a single net number. Clearly label each component so the owner can trace the arithmetic.

### Step 4 — Align the shift view
Optionally adjust `PettyCashSection.tsx` so any standalone-fund figures it references are consistent with the equation, or clearly separate "shift float" from "fund balance" in the UI to avoid mixing the two concepts.

## Dependencies
- [36-standalone-petty-cash-fund](./36-standalone-petty-cash-fund.md) — provides the initial allocation and fund model the equation anchors on.
- [40-petty-cash-low-alerts](./40-petty-cash-low-alerts.md) — consumes the computed balance for threshold alerts.
- [41-petty-cash-export](./41-petty-cash-export.md) — can reuse the same balance components.
- Existing `Expense` model and expense query.

## Files / Areas affected
- `erp/src/lib/services/petty-cash.service.ts` — balance-equation function.
- API endpoint under `erp/src/app/api/store/petty-cash/`.
- Standalone petty-cash UI (from doc 36) — equation display.
- `erp/src/components/shift/PettyCashSection.tsx` — optional alignment/clarification.
