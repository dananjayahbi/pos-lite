import Decimal from 'decimal.js';

/**
 * Sri Lankan statutory payroll constants.
 *
 * EPF: employee 8% + employer 12% of monthly earnings.
 * ETF: employer 3%.
 * The rates are fixed by law but stored on each payroll run so a historical
 * payslip always shows the rate that was actually applied.
 */
export const PAYROLL_STATUTORY_RATES = {
  employeeEpf: 8,
  employerEpf: 12,
  employerEtf: 3,
} as const;

/** Standard monthly working days used to derive a day rate. */
export const DEFAULT_WORKING_DAYS = 26;

/** Statutory overtime premium (1.5× the ordinary hourly rate). */
export const DEFAULT_OVERTIME_MULTIPLIER = 1.5;

export const STANDARD_WORKDAY_HOURS = 8;

const MONEY_SCALE = 2;

/** Round to cents with the same half-up rule used across the money code. */
export function money(value: Decimal.Value): Decimal {
  return new Decimal(value).toDecimalPlaces(MONEY_SCALE, Decimal.ROUND_HALF_UP);
}

export function moneyString(value: Decimal.Value): string {
  return money(value).toFixed(MONEY_SCALE);
}

/**
 * Number of Monday–Friday working days in a `YYYY-MM` month. Used as the
 * default day rate base; tenants that work Saturdays can override it.
 */
export function countWeekdaysInMonth(month: string): number {
  const [yearRaw, monthRaw] = month.split('-');
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;
  if (!Number.isInteger(year) || monthIndex < 0 || monthIndex > 11) {
    return DEFAULT_WORKING_DAYS;
  }

  let count = 0;
  const cursor = new Date(year, monthIndex, 1);
  while (cursor.getMonth() === monthIndex) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count > 0 ? count : DEFAULT_WORKING_DAYS;
}

/** Absent days + half of each half-day are unpaid; approved leave stays paid. */
export function deriveNoPayDays(daysAbsent: number, daysHalfDay: number): Decimal {
  return new Decimal(daysAbsent).add(new Decimal(daysHalfDay).times(0.5)).toDecimalPlaces(1);
}

export interface PayrollCalculationInput {
  basicSalary: Decimal.Value;
  allowances: Decimal.Value;
  overtimeMinutes: number;
  overtimeMultiplier: Decimal.Value;
  workingDays: number;
  commissionAmount: Decimal.Value;
  noPayDays: Decimal.Value;
  advanceDeduction: Decimal.Value;
  employeeEpfRate?: Decimal.Value;
  employerEpfRate?: Decimal.Value;
  employerEtfRate?: Decimal.Value;
}

export interface PayrollCalculationResult {
  basicSalary: string;
  allowances: string;
  overtimeMinutes: number;
  overtimeHourlyRate: string;
  overtimeAmount: string;
  commissionAmount: string;
  grossSalary: string;
  noPayDays: string;
  noPayDeduction: string;
  advanceDeduction: string;
  totalDeductions: string;
  employeeEpf: string;
  employerEpf: string;
  employerEtf: string;
  netSalary: string;
  totalCompanyCost: string;
}

function nonNegative(value: Decimal.Value): Decimal {
  const decimal = new Decimal(value);
  return decimal.isNegative() || decimal.isNaN() ? new Decimal(0) : decimal;
}

/**
 * Pure payroll calculation shared by the preview, the persisted run and the
 * payslip renderer. The client never supplies money that is not re-derived
 * here; only no-pay days and advance deductions are caller-controlled.
 *
 *   gross = basic + allowances + overtime + commission
 *   deductions = no-pay + advances
 *   net = gross - deductions - employee EPF (8%)
 */
export function calculatePayroll(input: PayrollCalculationInput): PayrollCalculationResult {
  const basicSalary = money(nonNegative(input.basicSalary));
  const allowances = money(nonNegative(input.allowances));
  const commissionAmount = money(nonNegative(input.commissionAmount));
  const workingDays = Math.max(1, Math.trunc(input.workingDays));
  const overtimeMinutes = Math.max(0, Math.trunc(input.overtimeMinutes));
  const overtimeMultiplier = nonNegative(input.overtimeMultiplier);

  const overtimeHourlyRate = basicSalary.div(workingDays * STANDARD_WORKDAY_HOURS);
  const overtimeAmount = money(
    overtimeHourlyRate.times(new Decimal(overtimeMinutes).div(60)).times(overtimeMultiplier),
  );

  const grossSalary = money(
    basicSalary.plus(allowances).plus(overtimeAmount).plus(commissionAmount),
  );

  const noPayDays = new Decimal(nonNegative(input.noPayDays)).toDecimalPlaces(1);
  const noPayDeduction = money(
    Decimal.min(basicSalary.div(workingDays).times(noPayDays), basicSalary),
  );
  const advanceDeduction = money(nonNegative(input.advanceDeduction));
  const totalDeductions = money(noPayDeduction.plus(advanceDeduction));

  const employeeEpfRate = nonNegative(input.employeeEpfRate ?? PAYROLL_STATUTORY_RATES.employeeEpf);
  const employerEpfRate = nonNegative(input.employerEpfRate ?? PAYROLL_STATUTORY_RATES.employerEpf);
  const employerEtfRate = nonNegative(input.employerEtfRate ?? PAYROLL_STATUTORY_RATES.employerEtf);

  const employeeEpf = money(grossSalary.times(employeeEpfRate).div(100));
  const employerEpf = money(grossSalary.times(employerEpfRate).div(100));
  const employerEtf = money(grossSalary.times(employerEtfRate).div(100));

  const netSalary = money(
    Decimal.max(grossSalary.minus(totalDeductions).minus(employeeEpf), 0),
  );
  const totalCompanyCost = money(grossSalary.plus(employerEpf).plus(employerEtf));

  return {
    basicSalary: basicSalary.toFixed(MONEY_SCALE),
    allowances: allowances.toFixed(MONEY_SCALE),
    overtimeMinutes,
    overtimeHourlyRate: overtimeHourlyRate.toFixed(4),
    overtimeAmount: overtimeAmount.toFixed(MONEY_SCALE),
    commissionAmount: commissionAmount.toFixed(MONEY_SCALE),
    grossSalary: grossSalary.toFixed(MONEY_SCALE),
    noPayDays: noPayDays.toFixed(1),
    noPayDeduction: noPayDeduction.toFixed(MONEY_SCALE),
    advanceDeduction: advanceDeduction.toFixed(MONEY_SCALE),
    totalDeductions: totalDeductions.toFixed(MONEY_SCALE),
    employeeEpf: employeeEpf.toFixed(MONEY_SCALE),
    employerEpf: employerEpf.toFixed(MONEY_SCALE),
    employerEtf: employerEtf.toFixed(MONEY_SCALE),
    netSalary: netSalary.toFixed(MONEY_SCALE),
    totalCompanyCost: totalCompanyCost.toFixed(MONEY_SCALE),
  };
}
