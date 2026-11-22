/**
 * Pure readiness guard for generating a payroll run (ARGUS #375).
 *
 * A live preview can legitimately contain rows whose net pay is Rs 0.00 - for
 * example when no staff has a basic salary configured yet. Generating that
 * snapshot still consumes the tenant/month uniqueness lock, so the run can no
 * longer be regenerated. These checks decide whether generation must be
 * refused or needs an explicit confirmation from the operator.
 *
 * The same helper is used by the server (authoritative) and by the Run Payroll
 * page (so the button and the warnings agree).
 */

export interface PayrollReadinessRow {
  userId: string;
  staffName: string;
  basicSalary: number | string;
  allowances: number | string;
  grossSalary: number | string;
  netSalary: number | string;
  /** False when neither basic salary nor allowances are configured. */
  hasSalaryConfig: boolean;
}

export interface PayrollReadinessStaff {
  userId: string;
  staffName: string;
}

export type PayrollReadinessWarningCode = 'ALL_ZERO_PAY' | 'UNSALARIED_STAFF';

export interface PayrollReadinessWarning {
  code: PayrollReadinessWarningCode;
  message: string;
  staff: PayrollReadinessStaff[];
}

export interface PayrollReadinessBlock {
  code: 'NO_STAFF';
  message: string;
}

export interface PayrollReadiness {
  /** False when every row has no gross and no net pay. */
  hasPayableStaff: boolean;
  /** Rows with a non-zero gross or net salary. */
  payableStaffCount: number;
  /** Rows whose net pay is zero (still included on the run). */
  zeroPayStaff: PayrollReadinessStaff[];
  /** Rows with no basic salary or allowances configured. */
  unsalariedStaff: PayrollReadinessStaff[];
  /** Sum of the displayed net salary, to 2 decimals. */
  totalNet: string;
  /** A hard refusal: there is nothing to generate at all. */
  blocking: PayrollReadinessBlock | null;
  warnings: PayrollReadinessWarning[];
  /** True when generation is allowed only after acknowledging the warnings. */
  requiresConfirmation: boolean;
  confirmationMessage: string | null;
}

function toNumber(value: number | string): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isPositive(value: number | string): boolean {
  return toNumber(value) > 0;
}

function staffRef(row: PayrollReadinessRow): PayrollReadinessStaff {
  return { userId: row.userId, staffName: row.staffName };
}

/** "A, B and 3 more" - keeps the confirmation message readable. */
export function listStaffNames(
  staff: PayrollReadinessStaff[],
  visibleLimit = 3,
): string {
  const names = staff.map((member) => member.staffName);
  if (names.length <= visibleLimit) return names.join(', ');
  const remaining = names.length - visibleLimit;
  return `${names.slice(0, visibleLimit).join(', ')} and ${remaining} more`;
}

export function assessPayrollRunReadiness(
  rows: PayrollReadinessRow[],
): PayrollReadiness {
  const totalNetValue = rows.reduce((sum, row) => sum + toNumber(row.netSalary), 0);
  const totalNet = totalNetValue.toFixed(2);
  const payableStaffCount = rows.filter(
    (row) => isPositive(row.grossSalary) || isPositive(row.netSalary),
  ).length;
  const zeroPayStaff = rows
    .filter((row) => !isPositive(row.netSalary))
    .map(staffRef);
  const unsalariedStaff = rows
    .filter((row) => !row.hasSalaryConfig)
    .map(staffRef);

  const warnings: PayrollReadinessWarning[] = [];

  if (rows.length > 0 && totalNetValue <= 0) {
    warnings.push({
      code: 'ALL_ZERO_PAY',
      message:
        'Every employee in this run has a net pay of Rs 0.00. Generating it locks the month until the run is voided.',
      staff: zeroPayStaff,
    });
  }

  if (unsalariedStaff.length > 0) {
    warnings.push({
      code: 'UNSALARIED_STAFF',
      message: `${unsalariedStaff.length} ${
        unsalariedStaff.length === 1 ? 'employee has' : 'employees have'
      } no basic salary or allowances configured: ${listStaffNames(unsalariedStaff)}. They are still included at Rs 0.00 and can appear on bank and EPF/ETF exports.`,
      staff: unsalariedStaff,
    });
  }

  const blocking: PayrollReadinessBlock | null =
    rows.length === 0
      ? {
          code: 'NO_STAFF',
          message: 'No active staff members to pay for this month.',
        }
      : null;

  return {
    hasPayableStaff: payableStaffCount > 0,
    payableStaffCount,
    zeroPayStaff,
    unsalariedStaff,
    totalNet,
    blocking,
    warnings,
    requiresConfirmation: blocking === null && warnings.length > 0,
    confirmationMessage:
      warnings.length > 0 ? warnings.map((warning) => warning.message).join(' ') : null,
  };
}
