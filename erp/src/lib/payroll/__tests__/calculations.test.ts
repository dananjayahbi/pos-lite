import { describe, expect, it } from 'vitest';
import {
  PAYROLL_STATUTORY_RATES,
  calculatePayroll,
  countWeekdaysInMonth,
  deriveNoPayDays,
  money,
} from '@/lib/payroll/calculations';

describe('payroll calculations', () => {
  it('computes gross, EPF/ETF and net for a full month', () => {
    const result = calculatePayroll({
      basicSalary: 60000,
      allowances: 10000,
      overtimeMinutes: 0,
      overtimeMultiplier: 1.5,
      workingDays: 26,
      commissionAmount: 5000,
      noPayDays: 0,
      advanceDeduction: 0,
    });

    // Gross = 60,000 + 10,000 + 0 + 5,000
    expect(result.grossSalary).toBe('75000.00');
    // Employee EPF 8%
    expect(result.employeeEpf).toBe('6000.00');
    expect(result.employerEpf).toBe('9000.00');
    expect(result.employerEtf).toBe('2250.00');
    // Net = 75,000 - 0 - 6,000
    expect(result.netSalary).toBe('69000.00');
    // Company cost = gross + employer EPF + employer ETF
    expect(result.totalCompanyCost).toBe('86250.00');
  });

  it('adds overtime at 1.5× the day-rate hourly wage', () => {
    // 60,000 / (26 × 8) = 288.4615 per hour; 10 OT hours × 1.5 = 4,326.92
    const result = calculatePayroll({
      basicSalary: 60000,
      allowances: 0,
      overtimeMinutes: 600,
      overtimeMultiplier: 1.5,
      workingDays: 26,
      commissionAmount: 0,
      noPayDays: 0,
      advanceDeduction: 0,
    });

    expect(result.overtimeHourlyRate).toBe('288.4615');
    expect(result.overtimeAmount).toBe('4326.92');
    expect(result.grossSalary).toBe('64326.92');
  });

  it('deducts no-pay days and salary advances before EPF', () => {
    const result = calculatePayroll({
      basicSalary: 52000,
      allowances: 0,
      overtimeMinutes: 0,
      overtimeMultiplier: 1.5,
      workingDays: 26,
      commissionAmount: 0,
      noPayDays: 2,
      advanceDeduction: 5000,
    });

    // Day rate = 2,000; 2 no-pay days = 4,000
    expect(result.noPayDeduction).toBe('4000.00');
    expect(result.totalDeductions).toBe('9000.00');
    // Employee EPF still applies to gross (52,000 × 8% = 4,160)
    expect(result.employeeEpf).toBe('4160.00');
    // Net = 52,000 - 9,000 - 4,160
    expect(result.netSalary).toBe('38840.00');
  });

  it('never produces a negative net salary', () => {
    const result = calculatePayroll({
      basicSalary: 10000,
      allowances: 0,
      overtimeMinutes: 0,
      overtimeMultiplier: 1.5,
      workingDays: 26,
      commissionAmount: 0,
      noPayDays: 30,
      advanceDeduction: 10000,
    });
    expect(result.netSalary).toBe('0.00');
  });

  it('caps the no-pay deduction at the basic salary', () => {
    const result = calculatePayroll({
      basicSalary: 26000,
      allowances: 5000,
      overtimeMinutes: 0,
      overtimeMultiplier: 1.5,
      workingDays: 26,
      commissionAmount: 0,
      noPayDays: 30,
      advanceDeduction: 0,
    });
    expect(result.noPayDeduction).toBe('26000.00');
  });

  it('keeps the statutory rates configurable and stores what was applied', () => {
    const result = calculatePayroll({
      basicSalary: 100000,
      allowances: 0,
      overtimeMinutes: 0,
      overtimeMultiplier: 1.5,
      workingDays: 26,
      commissionAmount: 0,
      noPayDays: 0,
      advanceDeduction: 0,
      employeeEpfRate: 8,
      employerEpfRate: 12,
      employerEtfRate: 3,
    });
    expect(PAYROLL_STATUTORY_RATES).toEqual({ employeeEpf: 8, employerEpf: 12, employerEtf: 3 });
    expect(result.employeeEpf).toBe('8000.00');
  });
});

describe('deriveNoPayDays', () => {
  it('counts half days as half an unpaid day', () => {
    expect(deriveNoPayDays(2, 3).toFixed(1)).toBe('3.5');
  });

  it('returns zero when there are no absences', () => {
    expect(deriveNoPayDays(0, 0).toFixed(1)).toBe('0.0');
  });
});

describe('countWeekdaysInMonth', () => {
  it('returns the Monday–Friday count for a month', () => {
    expect(countWeekdaysInMonth('2026-11')).toBe(21);
    expect(countWeekdaysInMonth('2026-02')).toBe(20);
  });

  it('falls back to the default for invalid months', () => {
    expect(countWeekdaysInMonth('nope')).toBe(26);
  });
});

describe('money', () => {
  it('rounds half-up to two decimals', () => {
    expect(money('10.005').toFixed(2)).toBe('10.01');
    expect(money(10.004).toFixed(2)).toBe('10.00');
  });
});
