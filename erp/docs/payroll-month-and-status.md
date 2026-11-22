# Payroll month, status and notes (ARGUS #382)

## Month contract

`src/lib/payroll/payroll-month.core.ts` owns the `YYYY-MM` rule:

- empty means the current local month;
- malformed keys are rejected;
- a month later than the current one is rejected as future.

The preview and generate routes enforce it (`400 VALIDATION_ERROR`), and the
Run Payroll and Reports month inputs use `currentPayrollMonth()` as `max`.

## Status

Recent runs render `describePayrollRunStatus(...).statusLabel` (Unpaid / Paid /
Draft) instead of the raw `GENERATED` enum. The Reports page already shows the
payment detail derived from the `PAYROLL_RUN_PAID` audit entry.

## Notes

Notes entered at generation are part of the run snapshot and are shown in a
"Run notes" card on the Reports page.

## Run history

`/payroll` loads the latest 12 runs and offers "Show more months" up to the
server cap of 60; it no longer implies that 12 is the whole history. A specific
older month is still reachable through the server-side month lookup used by the
Reports page (ARGUS #392).
