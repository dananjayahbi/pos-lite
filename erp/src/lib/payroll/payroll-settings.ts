/**
 * Tenant-level payroll settings stored in `Tenant.settings.payroll`.
 *
 * The statutory contribution rates are fixed by Sri Lankan law and live in
 * calculations.ts. These settings cover the tenant-specific inputs that the
 * C-form and the day-rate calculation need.
 */
import {
  DEFAULT_OVERTIME_MULTIPLIER,
  DEFAULT_WORKING_DAYS,
} from '@/lib/payroll/calculations';

export interface PayrollSettings {
  /** Employer EPF registration number printed on the C-form. */
  employerEpfNumber: string;
  /** Employer ETF registration number printed on the ETF return. */
  employerEtfNumber: string;
  /** Monthly working days: 0 means "derive from the calendar". */
  workingDays: number;
  /** Overtime premium, e.g. 1.5 for time-and-a-half. */
  overtimeMultiplier: number;
}

export const DEFAULT_PAYROLL_SETTINGS: PayrollSettings = {
  employerEpfNumber: '',
  employerEtfNumber: '',
  workingDays: 0,
  overtimeMultiplier: DEFAULT_OVERTIME_MULTIPLIER,
};

/** Key inside the tenant `settings` JSON column. */
export const PAYROLL_SETTINGS_STORAGE_KEY = 'payroll';

function text(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function finiteNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return fallback;
  return parsed;
}

export function parsePayrollSettings(raw: unknown): PayrollSettings {
  const source =
    typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};

  const workingDays = finiteNumber(
    source.workingDays,
    DEFAULT_PAYROLL_SETTINGS.workingDays,
    0,
    31,
  );

  return {
    employerEpfNumber: text(source.employerEpfNumber, 40),
    employerEtfNumber: text(source.employerEtfNumber, 40),
    workingDays: Number.isInteger(workingDays)
      ? workingDays
      : DEFAULT_PAYROLL_SETTINGS.workingDays,
    overtimeMultiplier: finiteNumber(
      source.overtimeMultiplier,
      DEFAULT_PAYROLL_SETTINGS.overtimeMultiplier,
      1,
      4,
    ),
  };
}

export function readPayrollSettingsFromTenantSettings(settings: unknown): PayrollSettings {
  const source =
    typeof settings === 'object' && settings !== null
      ? (settings as Record<string, unknown>)
      : {};
  return parsePayrollSettings(source.payroll);
}

/** Resolve the working-day base for a run: configured value or calendar default. */
export function resolveWorkingDays(
  settings: PayrollSettings,
  calendarWeekdays: number,
): number {
  if (settings.workingDays > 0) return settings.workingDays;
  return calendarWeekdays > 0 ? calendarWeekdays : DEFAULT_WORKING_DAYS;
}

export { DEFAULT_WORKING_DAYS };
