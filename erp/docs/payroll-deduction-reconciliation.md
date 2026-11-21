# Deduction labels and gross-to-net reconciliation (ARGUS #386)

## Problem

The Reports employee table had a column called **Deductions** that showed only
`no-pay + advances`. Employee EPF was a separate amount that appeared nowhere in
that table, so the numbers did not reconcile:

```
Gross 34,109.56 - Deductions 3,000.00 = 31,109.56
Net pay shown                          = 28,380.80
Unlabelled difference                  =  2,728.76  (employee EPF)
```

The summary export used the same ambiguous "Deductions" label, and the payslip
showed an EPF row before a "Total Deductions" value that excluded EPF.

## Rules

For every row:

```
Net = Gross - (No-pay + advances) - Employee EPF
```

For the summary totals:

```
Total deductions incl. employee EPF = No-pay + advances + Employee EPF
Net payable/paid = Gross - Total deductions incl. employee EPF
```

`SummaryReportTotals.deductionsIncludingEpf` is populated by
`summaryTotals()` with `Decimal(totalDeductions + totalEmployeeEpf)`.
`totalDeductionsIncludingEpf(totals)` is a pure helper for the document
renderers and tests.

## Surfaces changed

- `/payroll/reports` company-cost card: **No-pay + advances**, **Employee EPF**
  and a bold **Total deductions incl. employee EPF** row before Net.
- `/payroll/reports` employee table: header **No-pay + advances**, a separate
  **Employee EPF** column, then **Net pay**, with the formula stated above the
  table.
- Summary XLSX/PDF breakdown: "Deductions (no-pay + advances)" becomes
  "No-pay + advances"; a "Total deductions incl. employee EPF" row follows
  Employee EPF.
- Summary detail XLSX/PDF header: **No-pay + advances** and **Employee EPF**,
  plus a footnote stating the per-employee formula.
- Payslip: "Total Deductions" is now "Total (no-pay + advances)" so it cannot be
  mistaken for a total that includes EPF.

The stored `PayrollItem.totalDeductions` field is unchanged (no schema or
migration change); only its presentation label and the derived total are new.
