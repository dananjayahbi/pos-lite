import Decimal from 'decimal.js';

import {
  PAYROLL_STATUTORY_RATES,
  calculatePayroll,
  moneyString,
  type PayrollCalculationResult,
} from '@/lib/payroll/calculations';

/**
 * One payslip view for the Staff Directory (ARGUS #338).
 *
 * Staff without a configured salary cannot have a salary payslip. Instead of
 * printing an all-zero payslip that claims "Total Payable", the same document
 * becomes an explicit "Attendance & Commission Statement" — the caller only
 * renders salary/EPF/ETF/net-pay sections when `documentKind === 'PAYSLIP'`.
 *
 * All arithmetic delegates to the payroll module's `calculatePayroll`, so a
 * staff payslip and a generated payroll run cannot disagree.
 */

export type PayslipDocumentKind = 'PAYSLIP' | 'STATEMENT';

export interface PayslipCommissionFigures {
  earned: string | number;
  paid: string | number;
  unpaid: string | number;
}

export interface PayslipSummaryInput {
  basicSalary: Decimal.Value | null | undefined;
  allowances: Decimal.Value | null | undefined;
  overtimeMinutes: number;
  workingDays: number;
  overtimeMultiplier: Decimal.Value;
  commission: PayslipCommissionFigures;
  noPayDays: Decimal.Value;
  advanceDeduction?: Decimal.Value;
  employeeEpfRate?: Decimal.Value;
  employerEpfRate?: Decimal.Value;
  employerEtfRate?: Decimal.Value;
}

export interface PayslipLine {
  label: string;
  /** 2dp amount string (no currency prefix). */
  amount: string;
}

export interface PayslipSummary {
  documentKind: PayslipDocumentKind;
  title: string;
  hasSalary: boolean;
  /** Full payroll breakdown; null for an attendance/commission statement. */
  payroll: PayrollCalculationResult | null;
  earnings: PayslipLine[];
  deductions: PayslipLine[];
  employerContributions: PayslipLine[];
  /** Take-home pay; null when there is no salary configuration. */
  netPay: string | null;
  commission: { earned: string; paid: string; unpaid: string };
  footerNote: string;
}

export function hasSalaryConfiguration(input: {
  basicSalary: Decimal.Value | null | undefined;
  allowances: Decimal.Value | null | undefined;
}): boolean {
  const basic = new Decimal(input.basicSalary ?? 0);
  const allowances = new Decimal(input.allowances ?? 0);
  return basic.greaterThan(0) || allowances.greaterThan(0);
}

export function buildPayslipSummary(input: PayslipSummaryInput): PayslipSummary {
  const staffRates = {
    employeeEpfRate: input.employeeEpfRate ?? PAYROLL_STATUTORY_RATES.employeeEpf,
    employerEpfRate: input.employerEpfRate ?? PAYROLL_STATUTORY_RATES.employerEpf,
    employerEtfRate: input.employerEtfRate ?? PAYROLL_STATUTORY_RATES.employerEtf,
  };

  const commission = {
    earned: moneyString(input.commission.earned),
    paid: moneyString(input.commission.paid),
    unpaid: moneyString(input.commission.unpaid),
  };

  const hasSalary = hasSalaryConfiguration(input);

  if (!hasSalary) {
    return {
      documentKind: 'STATEMENT',
      title: 'Attendance & Commission Statement',
      hasSalary: false,
      payroll: null,
      earnings: [],
      deductions: [],
      employerContributions: [],
      netPay: null,
      commission,
      footerNote:
        'No base salary is configured for this account. This document is an attendance and commission statement, not a salary payslip. Update the staff profile salary to receive a full payslip.',
    };
  }

  const payroll = calculatePayroll({
    basicSalary: input.basicSalary ?? 0,
    allowances: input.allowances ?? 0,
    overtimeMinutes: input.overtimeMinutes,
    overtimeMultiplier: input.overtimeMultiplier,
    workingDays: input.workingDays,
    // Payroll settles only the still-unpaid commission, so a standalone
    // commission payout is never paid twice (same rule as the payroll run).
    commissionAmount: commission.unpaid,
    noPayDays: input.noPayDays,
    advanceDeduction: input.advanceDeduction ?? 0,
    employeeEpfRate: staffRates.employeeEpfRate,
    employerEpfRate: staffRates.employerEpfRate,
    employerEtfRate: staffRates.employerEtfRate,
  });

  return {
    documentKind: 'PAYSLIP',
    title: 'Staff Payslip',
    hasSalary: true,
    payroll,
    earnings: [
      { label: 'Basic Salary', amount: payroll.basicSalary },
      { label: 'Allowances', amount: payroll.allowances },
      {
        label: `Overtime (${payroll.overtimeMinutes} min)`,
        amount: payroll.overtimeAmount,
      },
      { label: 'Sales Commission (unpaid)', amount: payroll.commissionAmount },
      { label: 'Gross Salary', amount: payroll.grossSalary },
    ],
    deductions: [
      { label: `No-Pay (${payroll.noPayDays} day(s))`, amount: payroll.noPayDeduction },
      { label: 'Salary Advances', amount: payroll.advanceDeduction },
      {
        label: `Employee EPF (${String(staffRates.employeeEpfRate)}%)`,
        amount: payroll.employeeEpf,
      },
      { label: 'Total Deductions', amount: payroll.totalDeductions },
    ],
    employerContributions: [
      {
        label: `Employer EPF (${String(staffRates.employerEpfRate)}%)`,
        amount: payroll.employerEpf,
      },
      {
        label: `Employer ETF (${String(staffRates.employerEtfRate)}%)`,
        amount: payroll.employerEtf,
      },
    ],
    netPay: payroll.netSalary,
    commission,
    footerNote:
      'Net salary = gross salary - (no-pay + advances) - employee EPF. Employer EPF/ETF are paid by the company and are not deducted from the employee.',
  };
}
