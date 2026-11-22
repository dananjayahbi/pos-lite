# Audited payroll export downloads (ARGUS #391)

## Problem

The bank worksheet, EPF C-form/ETF return and monthly summary routes generated
sensitive files (bank accounts, NICs, EPF/ETF numbers) without writing an audit
row. A download could not be attributed to an actor, run, format or time.

## Rule

Every successful export build now writes one durable audit entry:

```
action:     PAYROLL_EXPORT_DOWNLOADED
entityType: PayrollRun
entityId:   <run id>
after: {
  exportType: 'bank-sheet' | 'statutory' | 'summary',
  format: 'xlsx' | 'pdf',
  periodMonth: 'YYYY-MM',
  itemCount: number,
  incompleteOverride: boolean
}
```

The payload is built by the pure, unit-tested
`src/lib/payroll/export-audit.core.ts` helper. The route calls
`recordPayrollExportDownload()` in `payroll-exports.service`, which uses
`writeAuditLog` - the durable writer that rethrows on failure. An export that
cannot be audited is therefore not returned.

## Scope

Applied to all six successful paths:

- `GET /api/store/payroll/runs/[id]/exports/bank-sheet?format=xlsx|pdf`
- `GET /api/store/payroll/runs/[id]/exports/statutory?format=xlsx|pdf`
- `GET /api/store/payroll/runs/[id]/exports/summary?format=xlsx|pdf`

`incompleteOverride` is true only when the caller explicitly downloads a
flagged bank/statutory file with `allowIncomplete=1`. Item counts are the rows
actually written (eligible rows after ARGUS #388 filtering for bank/statutory).

## Risks and gaps

- Audit failure now fails the download (security-first, per the durable writer).
- Payslip downloads/prints are a separate surface and are not covered by this
  task.
- No retention/rotation policy is changed; existing audit infrastructure owns
  that.

No schema, migration, package or lock change is involved.
