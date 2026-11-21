import Decimal from 'decimal.js';

/**
 * Payroll export eligibility (ARGUS #388).
 *
 * A generated run can contain rows whose gross and net are both Rs 0.00 (no
 * salary configured, no commission). Counting and exporting them as employees
 * overstates headcount and puts blank/zero lines into bank and EPF/ETF files.
 *
 * Bank files need money to move (net > 0). Statutory returns still need a row
 * when there is a contribution to report, even if net pay was reduced to zero.
 */

type Decimalish = Decimal | { toString(): string } | number | string | null | undefined;

export interface PayrollEligibilityItem {
  staffName: string;
  grossSalary: Decimalish;
  netSalary: Decimalish;
  employeeEpf?: Decimalish;
  employerEpf?: Decimalish;
  employerEtf?: Decimalish;
}

export type PayrollExportScope = 'bank-sheet' | 'statutory' | 'summary';

function dec(value: Decimalish): Decimal {
  if (value === null || value === undefined) return new Decimal(0);
  try {
    return new Decimal(value.toString());
  } catch {
    return new Decimal(0);
  }
}

/** Money actually payable to the employee's bank account. */
export function isBankPayable(item: PayrollEligibilityItem): boolean {
  return dec(item.netSalary).gt(0.005);
}

/** Any statutory contribution or earnings to report on the C-form/ETF return. */
export function isStatutoryReportable(item: PayrollEligibilityItem): boolean {
  return (
    dec(item.grossSalary).gt(0.005) ||
    dec(item.employeeEpf).gt(0.005) ||
    dec(item.employerEpf).gt(0.005) ||
    dec(item.employerEtf).gt(0.005)
  );
}

/** True when the row has no earnings and no contribution at all. */
export function isZeroEarnings(item: PayrollEligibilityItem): boolean {
  return (
    dec(item.grossSalary).abs().lte(0.005) &&
    dec(item.netSalary).abs().lte(0.005) &&
    dec(item.employeeEpf ?? 0).abs().lte(0.005) &&
    dec(item.employerEpf ?? 0).abs().lte(0.005) &&
    dec(item.employerEtf ?? 0).abs().lte(0.005)
  );
}

export function filterPayrollExportItems<T extends PayrollEligibilityItem>(
  items: readonly T[],
  scope: PayrollExportScope,
): T[] {
  if (scope === 'summary') return [...items];
  if (scope === 'bank-sheet') return items.filter(isBankPayable);
  return items.filter(isStatutoryReportable);
}

export interface PayrollHeadcount {
  total: number;
  /** Employees with net pay greater than zero. */
  paid: number;
  /** Rows with no earnings and no statutory contribution. */
  zeroEarnings: number;
  /** Rows reportable on a statutory return. */
  statutory: number;
}

export function summarizePayrollHeadcount(
  items: readonly PayrollEligibilityItem[],
): PayrollHeadcount {
  return {
    total: items.length,
    paid: items.filter(isBankPayable).length,
    zeroEarnings: items.filter(isZeroEarnings).length,
    statutory: items.filter(isStatutoryReportable).length,
  };
}
