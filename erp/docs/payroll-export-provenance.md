# Historical payroll export provenance (ARGUS #387)

## Problem

A payroll run snapshots salary, allowances, rates, attendance results and each
employee's bank/statutory identifiers. It does **not** snapshot the company
name or the employer EPF/ETF registration numbers, because `PayrollRun` has no
columns for them. Downloads read the current tenant profile and payroll
settings, so re-downloading an old month after a company rename or registration
change produces a document whose company block differs from the originally
issued copy.

Adding snapshot columns would require a migration, which is not allowed in this
task.

## Approach

`src/lib/payroll/export-provenance.ts` is pure and unit tested:

```ts
buildPayrollExportProvenance({
  companyName,
  employerEpfNumber,
  employerEtfNumber,
  generatedAt,
}) -> {
  snapshotComplete: false,
  companyName,
  employerEpfNumber,
  employerEtfNumber,
  generatedAt,
  label: 'Current company profile - not a historical snapshot',
  caveat: PAYROLL_EXPORT_PROVENANCE_CAVEAT,
  header: 'Regenerated <time> with current company profile - not a historical snapshot',
}
```

The caveat is explicit:

> Company name and employer EPF/ETF numbers are read from the current company
> profile. This document was regenerated at download time and may differ from
> the originally issued copy.

The export context builds this once per download. The payroll amounts, rates,
period and employee details continue to come from the immutable run snapshot;
only the company identity/registration block is current.

## Surfaces

- Bank salary worksheet: caveat row in XLSX and a small line under the status in
  the PDF header.
- EPF C-form and ETF return: caveat row on both XLSX sheets and under the status
  in both PDF pages.
- Monthly summary: caveat row in the XLSX summary sheet and under the status in
  the PDF.
- Reports page: every export card states the same caveat.

## Schema gap

`PayrollRun` would need company name / employer EPF and ETF number columns (or a
snapshot JSON column) to make historical exports fully immutable. Until such a
migration is approved, the caveat is the honest contract. No schema, migration,
package or lock change is included in this task.
