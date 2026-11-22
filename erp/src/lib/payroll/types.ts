/** Pure payroll shapes shared by the server service and client pages. */
import type { PayrollSettings } from '@/lib/payroll/payroll-settings';
import type {
  AttendanceCompleteness,
  AttendanceCompletenessSummary,
} from '@/lib/payroll/attendance-completeness.core';

export interface PayrollRowOverride {
  userId: string;
  noPayDays?: number | undefined;
  advanceDeduction?: number | undefined;
}

export interface PayrollPreviewRow {
  userId: string;
  staffName: string;
  staffEmail: string;
  role: string;
  nic: string | null;
  bankName: string | null;
  bankBranch: string | null;
  bankAccountNumber: string | null;
  epfNumber: string | null;
  etfNumber: string | null;
  basicSalary: string;
  allowances: string;
  overtimeMinutes: number;
  overtimeAmount: string;
  commissionAmount: string;
  grossSalary: string;
  noPayDays: string;
  noPayDeduction: string;
  advanceDeduction: string;
  /** ARGUS #379: net pay before the advance; the maximum this run may deduct. */
  advanceLimit: string;
  /** True when the requested advance was capped to `advanceLimit`. */
  advanceCapped: boolean;
  totalDeductions: string;
  employeeEpf: string;
  employerEpf: string;
  employerEtf: string;
  netSalary: string;
  totalCompanyCost: string;
  hasSalaryConfig: boolean;
  /** ARGUS #376: how much of the month's attendance actually has a record. */
  attendanceCompleteness: AttendanceCompleteness;
}

export interface PayrollPreviewTotals {
  basic: string;
  allowances: string;
  overtime: string;
  commission: string;
  gross: string;
  deductions: string;
  employeeEpf: string;
  employerEpf: string;
  employerEtf: string;
  net: string;
  companyCost: string;
}

export interface PayrollPreview {
  month: string;
  label: string;
  periodStart: string;
  periodEnd: string;
  workingDays: number;
  overtimeMultiplier: number;
  rates: {
    employeeEpf: number;
    employerEpf: number;
    employerEtf: number;
  };
  alreadyGenerated: boolean;
  runId: string | null;
  settings: PayrollSettings;
  rows: PayrollPreviewRow[];
  totals: PayrollPreviewTotals;
  /** ARGUS #376: incomplete/absent attendance records across the run. */
  attendanceSummary: AttendanceCompletenessSummary;
}
