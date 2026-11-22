# Zero-run guard and voiding a payroll run (ARGUS #375)

## Problem

A month with no salary configuration produced a live preview of Rs 0.00 while
**Generate payroll** stayed enabled. Generating it created an immutable-looking
run and consumed the `tenantId + periodMonth` uniqueness lock, so the month
could not be corrected. There was no zero/unsalaried confirmation and no way to
undo the mistake.

## Readiness guard

`src/lib/payroll/run-readiness.ts` is pure and shared by the API and the Run
Payroll page:

| Condition | Result |
| --- | --- |
| no active staff rows | hard refusal (`NO_STAFF`) - nothing to generate |
| every row has gross and net Rs 0.00 | `ALL_ZERO_PAY` confirmation required |
| any row has no basic salary and no allowances | `UNSALARIED_STAFF` confirmation required |

`assessPayrollRunReadiness(rows)` returns the payable staff count, the zero-pay
and unsalaried staff lists, the displayed net total, warnings and whether an
explicit confirmation is required.

The server re-runs the guard from its own preview, never from client money:

- no staff -> `400 VALIDATION_ERROR` with `details.code = NO_STAFF`;
- warnings not acknowledged -> `422 PAYROLL_CONFIRMATION_REQUIRED` with
  `details.warnings`, no `PayrollRun` row written.

`POST /api/store/payroll/runs` accepts `confirmZeroPayRun: true`. The UI shows
the same warnings, lists the unsalaried staff, and keeps **Generate payroll**
disabled until the operator ticks the acknowledgement.

## Voiding a run

`DELETE /api/store/payroll/runs/[id]` (permission `payroll:run`) voids an
unpaid run. In one transaction it:

1. finds the commission payouts reserved with the run's pending marker;
2. clears `CommissionRecord.payoutId` so the commission is available again;
3. deletes the pending payouts;
4. deletes the run - its `PayrollItem` snapshots cascade.

A `PAID` run is never deleted: its salary/EPF/ETF expenses and ledger entries
already exist, so the API returns `409 CONFLICT`. The action is audited as
`PAYROLL_RUN_VOIDED` with the run's month, status and net total in `before`.

The Run Payroll page adds a **Void** action on each `GENERATED` run, with a
confirmation dialog explaining that the month becomes regenerable.

## Copy

All UI copy uses plain hyphens. No schema or migration change is involved; the
existing `PayrollRunStatus` values (`GENERATED`, `PAID`) are sufficient.
