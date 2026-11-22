# Payroll test coverage map (ARGUS #383)

The payroll feature is split so the rules live in pure helpers and the same
helpers are used by the service, routes and UI.

| Rule | Helper | Test |
| --- | --- | --- |
| Gross, EPF/ETF on the no-pay-adjusted base, net | `payroll/calculations` | `calculations.test.ts` |
| Payslip deduction total reconciles gross to net | `payroll/deductions.core` | `deductions.core.test.ts` |
| Zero-run / unsalaried confirmation | `payroll/run-readiness` | `payroll-coverage.test.ts` |
| Returned-sale clawback netting, voided exclusion | `services/payrollCommission.core` | `payroll-coverage.test.ts` |
| Legacy `isPaid` is not money | `services/commissionSummary.core` | `payroll-coverage.test.ts` |
| Unpaid vs paid labels and export marker | `payroll/payroll-run-status` | `payroll-run-status.test.ts`, `payroll-coverage.test.ts` |
| Zero-earnings exclusion and headcount | `payroll/export-eligibility.core` | `payroll-coverage.test.ts` |
| Blank bank/statutory fields block a clean export | `payroll/export-preflight` | `payroll-coverage.test.ts`, `export-preflight.test.ts` |
| Payroll pages and separate print/download actions | UI | `tests/39_table_surfaces.spec.ts` (39.2) |
| Workbook cell values, totals, headcount and blank fields | `summary-report`, `bank-sheet`, `statutory-return` | `payroll-export-content.test.ts` |

Service functions that need Prisma (generate, pay, void) are covered through
these decisions rather than a database fixture; RBAC remains enforced by the
route guards (`payroll:view`, `payroll:run`) plus the commission-report access
tests.
