# Payroll headcount and zero-earnings export eligibility (ARGUS #388)

## Problem

The Reports page counted `run.items.length`, and the bank worksheet, C-form and
ETF return mapped every item. A run can contain staff rows with Rs 0.00
earnings (no salary configured, no commission), so headcount and export line
counts overstated the people actually paid and put blank/zero rows into bank
and statutory files.

## Rule

`src/lib/payroll/export-eligibility.core.ts` is pure and unit tested:

| Export | Include a row when |
| --- | --- |
| Bank salary worksheet | `netSalary > 0` (money actually moves) |
| EPF C-form / ETF return | `grossSalary > 0` OR any employee/employer EPF/ETF contribution > 0 |
| Monthly summary | all rows (management view) |

A row is **zero-earnings** only when gross, net, employee EPF, employer EPF and
ETF are all zero. A zero-net row with contributions (for example net paid away
by an advance) still appears on the statutory return, but not on the bank
worksheet.

`summarizePayrollHeadcount(items)` returns `total`, `paid` (net > 0),
`zeroEarnings` and `statutory` (reportable) counts.

## Enforcement

- `toBankSheetRows` and `toStatutoryRows` filter through the helper, so the
  documents' totals are computed from eligible rows only.
- Export preflight checks only eligible staff, so an excluded zero-earnings row
  with missing bank/NIC details cannot block a clean file.
- The Reports stat is now **Paid employees: N of M**; when zero-earnings staff
  exist, a note states they are excluded from bank/statutory rows and totals.
- The monthly summary still shows every row, including zeros, because it is a
  company-cost view.

No schema, migration, package or lock change is involved.
