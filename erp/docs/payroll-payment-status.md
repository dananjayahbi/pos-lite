# Payroll payment state in labels and exports (ARGUS #385)

## Problem

The Reports header said **Net payable** while the company-cost card and the
summary export said **Net salaries paid** even though the run was only
`GENERATED` - no salary had been paid. Exports also carried no run status,
payment date or approver, and no UNPAID/DRAFT marker.

## Rules

`src/lib/payroll/payroll-run-status.ts` is pure and unit tested:

| Run status | Net label | Marker |
| --- | --- | --- |
| `GENERATED` | Net payable | `UNPAID - generated, not yet paid (not a payment confirmation)` |
| `DRAFT` | Net payable | `DRAFT - not generated or paid` |
| `PAID` | Net salaries paid | `PAID - Paid on 30 Nov 2026 - approved by Nimal Silva` |
| unknown/blank | Net payable | treated as unpaid, never paid |

Payment date is formatted from the ISO timestamp when valid. If a PAID run has
no usable audit entry, the copy says **Payment date not recorded** rather than
inventing one.

## Payment date and approver without a migration

`PayrollRun` has no `paidAt` or `paidById` fields, and no migration may be
added. The existing `PAYROLL_RUN_PAID` audit entry already records `paidAt`,
the actor id/role and the payment account in its `after` JSON. The Reports run
detail now derives:

```ts
getPayrollRunPaymentInfo(tenantId, runId, status)
  -> { paidAt, approvedBy, approvedByRole, source }
```

`approvedBy` resolves the audit actor's `fullName`, falling back to email.
`source` is `not-paid`, `audit-log` or `unavailable` so the UI can be honest.
The run detail route returns this as `payment`; the export context loads the
same information once.

## UI and exports

- `/payroll/reports` shows a status banner: **Unpaid - Generated and unpaid -
  no payment recorded**, or **Paid - Paid on <date> - approved by <name>**.
- The Net stat and company-cost row use `Net payable` until `PAID`, then
  `Net salaries paid`.
- Bank worksheet, C-form/ETF return and summary header include the status
  marker; the summary's net row uses the same dynamic label and the PDF footer
  repeats the marker.
- The summary PDF emphasises the correct net row for the current status.

No schema, migration, package or lock change is involved.
