# PAYE/APIT income tax is not configured (ARGUS #389)

## Problem

Payroll net pay is:

```
Net = Gross - (No-pay + advances) - Employee EPF
```

No income-tax line exists in the calculation, payslip, bank worksheet, C-form,
ETF return or company-cost summary. Reports implied a complete statutory net
without saying that PAYE/APIT withholding was absent.

## Decision

The repository contains no Sri Lankan PAYE/APIT bands, reliefs or withholding
rules. Fabricating rates would be worse than an explicit gap, so this task does
not implement a tax calculation.

`src/lib/payroll/tax-disclosure.core.ts` is pure and unit tested and exports one
shared statement:

> PAYE/APIT income tax is not configured in this system. Net pay = gross -
> (no-pay + advances) - employee EPF; no income tax has been withheld or
> reported.

`describePayrollTaxTreatment()` returns `configured: false` and that message.
The tests assert the message contains no fabricated percentage.

## Surfaces

- `/payroll/reports` shows a **PAYE/APIT not configured** card under the run
  status.
- The monthly summary XLSX includes the statement in its header rows.
- The monthly summary PDF prints it under the run status.
- This document records the out-of-scope decision.

Implementing PAYE/APIT needs an approved statutory rule set (bands, reliefs,
employee declarations and effective dates) plus a migration for the withheld
amount/history. None of that is invented here. No schema, migration, package or
lock change is included.
