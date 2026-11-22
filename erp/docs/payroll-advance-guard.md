# Salary advance guard (ARGUS #379)

## Problem

Payroll Advance was a free-number deduction. There is no advance register,
outstanding balance, cap or repayment history in the schema, so the amount could
exceed what was actually advanced, exceed the employee's net pay, or be repeated
in a later run with no record.

Adding a register would require schema and migration work, which is out of scope
here. The safe migration-free guard is a hard cap against net pay.

## Rule

`src/lib/payroll/advance-validation.core.ts` is pure and unit tested:

```
maxAdvance  = max(0, gross - no-pay deduction - employee EPF)
allowed     = min(requested, maxAdvance)
capped      = requested > maxAdvance
```

`maxAdvance` is the employee's net pay before the advance, so the deduction can
never drive net pay below zero or overstate the deduction. The service computes
this from its own re-derived preview; the client applies the same helper only
for display. `POST /api/store/payroll/runs` therefore persists the capped value
even if a caller submits a larger number.

The preview row exposes `advanceLimit` and `advanceCapped`; the Run Payroll table
shows **capped at <amount> by net pay** when applicable.

## What this does NOT do

- It does not remember advances from previous months.
- It does not know the actual amount advanced or an outstanding repayment
  balance.
- It cannot prevent the same advance being entered again in another run.

A real advance register needs a migration (an advance/repayment table linked to
the staff member and payroll runs). Until then this cap is the documented,
enforced safety boundary. No schema, migration, package or lock change is
included.
