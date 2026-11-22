# Payroll export completeness preflight (ARGUS #378)

## Problem

The bank salary sheet and EPF/ETF return mapped missing staff details to blank
cells or `-`:

- bank sheet: `bankName ?? ''`, `bankAccountNumber ?? ''`;
- C-form: `nic ?? ''`, `epfNumber ?? ''`;
- ETF return: `nic ?? ''`, `etfNumber ?? ''`;
- statutory header: `employerEpfNumber || '-'`, `employerEtfNumber || '-'`.

A file could therefore be downloaded and sent to the bank or EPF/ETF with
silently incomplete rows, and no screen reported how many staff were affected.

## Required fields

`src/lib/payroll/export-preflight.ts` is pure and unit tested:

| Export | Employee fields | Employer fields |
| --- | --- | --- |
| Bank salary sheet | bank name, bank account number | - |
| EPF/ETF returns | NIC, EPF number, ETF number | employer EPF number, employer ETF number |
| Monthly summary | none | none |

A value is blank when it is missing, `null` or whitespace only. For each export
the helper returns `complete`, `affectedStaffCount`, the affected staff with
their missing field labels, `missingFieldCount`, `employerMissing` and a ready
message.

## Enforcement

- `GET /api/store/payroll/runs/[id]/exports/preflight` returns the preflight for
  all three exports, computed from the generated run snapshot and tenant payroll
  settings.
- The bank-sheet and statutory download routes run the same preflight. If it is
  incomplete and `allowIncomplete=1` is not present, they return
  `422 EXPORT_INCOMPLETE` with the full preflight in `details`; no file is
  generated.
- An explicit `allowIncomplete=1` (or `true`) is the deliberate override for an
  operator who needs the file despite blank cells.

The Reports page shows the warning for each card: count of affected employees,
the per-employee missing fields (first five, then "and N more") and employer
settings. Normal buttons become **Excel anyway** / **PDF anyway** links that
carry the override; a failed completeness check blocks the buttons and offers
**Retry check**. The monthly summary has no required fields and is never
blocked.

Payroll settings remain editable on the Run Payroll page
(`employerEpfNumber`, `employerEtfNumber`); staff fields are edited in the staff
profile. No schema or migration change is involved.
