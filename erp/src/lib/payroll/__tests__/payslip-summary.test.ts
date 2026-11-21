import { describe, expect, it } from 'vitest';

import { buildPayslipSummary, hasSalaryConfiguration } from '@/lib/payroll/payslip-summary';

const baseInput = {
  basicSalary: 0,
  allowances: 0,
  overtimeMinutes: 0,
  workingDays: 26,
  overtimeMultiplier: 1.5,
  commission: { earned: '0', paid: '0', unpaid: '0' },
  noPayDays: 0,
  advanceDeduction: 0,
};

/**
 * ARGUS #338 — the Staff Directory "payslip" must be a real salary payslip
 * when salary is configured, and an explicit statement when it is not.
 */
describe('hasSalaryConfiguration', () => {
  it('is true when basic salary or allowances are set', () => {
    expect(hasSalaryConfiguration({ basicSalary: 50000, allowances: 0 })).toBe(true);
    expect(hasSalaryConfiguration({ basicSalary: 0, allowances: 2500 })).toBe(true);
  });

  it('is false when both are zero/null', () => {
    expect(hasSalaryConfiguration({ basicSalary: 0, allowances: 0 })).toBe(false);
    expect(hasSalaryConfiguration({ basicSalary: null, allowances: null })).toBe(false);
  });
});

describe('buildPayslipSummary - salary configured', () => {
  it('produces basic/allowances/gross, EPF/ETF and net pay', () => {
    const summary = buildPayslipSummary({
      ...baseInput,
      basicSalary: '50000',
      allowances: '5000',
      commission: { earned: '1500.00', paid: '500.00', unpaid: '1000.00' },
    });

    expect(summary.documentKind).toBe('PAYSLIP');
    expect(summary.title).toBe('Staff Payslip');
    expect(summary.hasSalary).toBe(true);
    expect(summary.payroll?.grossSalary).toBe('56000.00');
    expect(summary.payroll?.employeeEpf).toBe('4480.00');
    expect(summary.payroll?.employerEpf).toBe('6720.00');
    expect(summary.payroll?.employerEtf).toBe('1680.00');
    expect(summary.netPay).toBe('51520.00');
    expect(summary.footerNote).toMatch(/Net salary = gross salary/i);
  });

  it('settles only the unpaid commission on the payslip', () => {
    const summary = buildPayslipSummary({
      ...baseInput,
      basicSalary: '30000',
      commission: { earned: '300.00', paid: '100.00', unpaid: '200.00' },
    });

    const commissionLine = summary.earnings.find((line) =>
      line.label.startsWith('Sales Commission'),
    );
    expect(commissionLine?.amount).toBe('200.00');
    expect(summary.commission).toEqual({
      earned: '300.00',
      paid: '100.00',
      unpaid: '200.00',
    });
    // Gross = 30000 basic + 200 unpaid commission.
    expect(summary.payroll?.grossSalary).toBe('30200.00');
  });

  it('applies overtime and no-pay deductions', () => {
    const summary = buildPayslipSummary({
      ...baseInput,
      basicSalary: '26000',
      overtimeMinutes: 60,
      noPayDays: '2',
    });

    // Hourly = 26000 / (26 * 8) = 125; 1 OT hour at 1.5x = 187.50.
    expect(summary.payroll?.overtimeAmount).toBe('187.50');
    // 2 no-pay days = 26000 / 26 * 2 = 2000.
    expect(summary.payroll?.noPayDeduction).toBe('2000.00');
    expect(summary.deductions.map((line) => line.label)).toContain('Salary Advances');
    expect(summary.employerContributions).toHaveLength(2);
  });

  it('labels the statutory rates used', () => {
    const summary = buildPayslipSummary({
      ...baseInput,
      basicSalary: '10000',
      employeeEpfRate: 8,
      employerEpfRate: 12,
      employerEtfRate: 3,
    });

    expect(summary.deductions.map((line) => line.label)).toContain('Employee EPF (8%)');
    expect(summary.employerContributions.map((line) => line.label)).toEqual([
      'Employer EPF (12%)',
      'Employer ETF (3%)',
    ]);
  });
});

describe('buildPayslipSummary - no salary configured', () => {
  it('falls back to an attendance & commission statement with no net pay', () => {
    const summary = buildPayslipSummary({
      ...baseInput,
      commission: { earned: '425.09', paid: '0.00', unpaid: '425.09' },
    });

    expect(summary.documentKind).toBe('STATEMENT');
    expect(summary.title).toBe('Attendance & Commission Statement');
    expect(summary.hasSalary).toBe(false);
    expect(summary.payroll).toBeNull();
    expect(summary.netPay).toBeNull();
    expect(summary.earnings).toEqual([]);
    expect(summary.deductions).toEqual([]);
    expect(summary.employerContributions).toEqual([]);
    expect(summary.footerNote).toMatch(/No base salary is configured/i);
    expect(summary.footerNote).toMatch(/not a salary payslip/i);
  });

  it('still carries the commission balances (payout-backed)', () => {
    const summary = buildPayslipSummary({
      ...baseInput,
      commission: { earned: '290.35', paid: '145.96', unpaid: '144.39' },
    });

    expect(summary.commission).toEqual({
      earned: '290.35',
      paid: '145.96',
      unpaid: '144.39',
    });
  });
});
