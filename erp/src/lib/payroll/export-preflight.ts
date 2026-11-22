/**
 * Export completeness preflight (ARGUS #378).
 *
 * The bank sheet and EPF/ETF return used to map missing staff details to blank
 * cells / "-" without telling anyone. These pure checks decide whether a file
 * is safe to download, which staff are affected and which fields are blank.
 * The export routes enforce them; the Reports page previews them.
 */

export type PayrollExportKind = 'bank-sheet' | 'statutory' | 'summary';

export interface PayrollExportStaffRow {
  staffName: string;
  bankName?: string | null;
  bankAccountNumber?: string | null;
  nic?: string | null;
  epfNumber?: string | null;
  etfNumber?: string | null;
}

export interface PayrollExportPreflightInput {
  kind: PayrollExportKind;
  staff: PayrollExportStaffRow[];
  /** Employer registration numbers printed on the C-form / ETF return. */
  employerEpfNumber?: string | null;
  employerEtfNumber?: string | null;
}

export interface PayrollExportMissingField {
  key: string;
  label: string;
}

export interface PayrollExportAffectedStaff {
  staffName: string;
  missingFields: string[];
}

export interface PayrollExportPreflight {
  kind: PayrollExportKind;
  label: string;
  complete: boolean;
  staffCount: number;
  affectedStaffCount: number;
  /** Per-staff blank fields, in the export's field order. */
  affectedStaff: PayrollExportAffectedStaff[];
  /** Every blank staff field occurrence (staff x field). */
  missingFieldCount: number;
  /** Employer-level blanks (statutory export only). */
  employerMissing: string[];
  message: string | null;
}

const EXPORT_LABELS: Record<PayrollExportKind, string> = {
  'bank-sheet': 'Bank salary worksheet',
  statutory: 'EPF/ETF monthly returns',
  summary: 'Monthly payroll summary',
};

const STAFF_FIELDS: Record<PayrollExportKind, PayrollExportMissingField[]> = {
  'bank-sheet': [
    { key: 'bankName', label: 'Bank name' },
    { key: 'bankAccountNumber', label: 'Bank account number' },
  ],
  statutory: [
    { key: 'nic', label: 'NIC (C-form)' },
    { key: 'epfNumber', label: 'EPF number (C-form)' },
    { key: 'etfNumber', label: 'ETF number (ETF return)' },
  ],
  summary: [],
};

const EMPLOYER_FIELDS: Record<
  PayrollExportKind,
  Array<{ key: 'employerEpfNumber' | 'employerEtfNumber'; label: string }>
> = {
  'bank-sheet': [],
  statutory: [
    { key: 'employerEpfNumber', label: 'Employer EPF number' },
    { key: 'employerEtfNumber', label: 'Employer ETF number' },
  ],
  summary: [],
};

function valueOf(row: PayrollExportStaffRow, key: string): unknown {
  return (row as unknown as Record<string, unknown>)[key];
}

function isBlank(value: unknown): boolean {
  return typeof value !== 'string' || value.trim().length === 0;
}

function uniqueLabels(labels: string[]): string[] {
  return [...new Set(labels)];
}

export function buildExportPreflight(
  input: PayrollExportPreflightInput,
): PayrollExportPreflight {
  const fields = STAFF_FIELDS[input.kind];
  const affectedStaff: PayrollExportAffectedStaff[] = [];
  let missingFieldCount = 0;

  for (const member of input.staff) {
    const missingFields = fields
      .filter((field) => isBlank(valueOf(member, field.key)))
      .map((field) => field.label);
    if (missingFields.length > 0) {
      missingFieldCount += missingFields.length;
      affectedStaff.push({ staffName: member.staffName, missingFields });
    }
  }

  const employerMissing = EMPLOYER_FIELDS[input.kind]
    .filter((field) => isBlank(input[field.key]))
    .map((field) => field.label);

  const missingLabels = uniqueLabels(
    affectedStaff.flatMap((member) => member.missingFields),
  );
  const messages: string[] = [];

  if (affectedStaff.length > 0) {
    messages.push(
      `${EXPORT_LABELS[input.kind]} is missing ${missingLabels.join(', ')} for ${affectedStaff.length} of ${input.staff.length} ${
        input.staff.length === 1 ? 'employee' : 'employees'
      }.`,
    );
  }
  if (employerMissing.length > 0) {
    messages.push(`Not configured: ${employerMissing.join(', ')}.`);
  }
  if (messages.length > 0) {
    messages.push('Complete the staff and payroll settings before downloading.');
  }

  return {
    kind: input.kind,
    label: EXPORT_LABELS[input.kind],
    complete: affectedStaff.length === 0 && employerMissing.length === 0,
    staffCount: input.staff.length,
    affectedStaffCount: affectedStaff.length,
    affectedStaff,
    missingFieldCount,
    employerMissing,
    message: messages.length > 0 ? messages.join(' ') : null,
  };
}
