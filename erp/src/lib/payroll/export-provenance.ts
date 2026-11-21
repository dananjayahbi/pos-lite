/**
 * Export provenance (ARGUS #387).
 *
 * A payroll run snapshots salary, rates, attendance and staff bank/statutory
 * details, but the schema stores no company identity or employer EPF/ETF
 * registration numbers on the run. Those values are read from the current
 * tenant profile at download time, so re-downloading an old month can change
 * the company block even though the payroll amounts did not change.
 *
 * No migration may be added, so every regenerated export carries an explicit
 * caveat instead of pretending the company block is historical.
 */

export const PAYROLL_EXPORT_PROVENANCE_CAVEAT =
  'Company name and employer EPF/ETF numbers are read from the current company profile. This document was regenerated at download time and may differ from the originally issued copy.';

export interface PayrollExportProvenanceInput {
  companyName: string;
  employerEpfNumber: string;
  employerEtfNumber: string;
  generatedAt: Date;
}

export interface PayrollExportProvenance {
  /** False until the run snapshots company identity/registration numbers. */
  snapshotComplete: boolean;
  companyName: string;
  employerEpfNumber: string;
  employerEtfNumber: string;
  generatedAt: string;
  label: string;
  caveat: string;
  /** Short line for an export header. */
  header: string;
}

function formatGeneratedAt(date: Date): string {
  if (Number.isNaN(date.getTime())) return 'unknown time';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function buildPayrollExportProvenance(
  input: PayrollExportProvenanceInput,
): PayrollExportProvenance {
  const generatedAt = formatGeneratedAt(input.generatedAt);
  return {
    snapshotComplete: false,
    companyName: input.companyName,
    employerEpfNumber: input.employerEpfNumber,
    employerEtfNumber: input.employerEtfNumber,
    generatedAt,
    label: 'Current company profile - not a historical snapshot',
    caveat: PAYROLL_EXPORT_PROVENANCE_CAVEAT,
    header: `Regenerated ${generatedAt} with current company profile - not a historical snapshot`,
  };
}
