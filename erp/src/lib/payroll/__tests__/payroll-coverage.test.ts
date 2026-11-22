import { describe, expect, it } from 'vitest';
import { calculatePayroll } from '@/lib/payroll/calculations';
import { assessPayrollRunReadiness } from '@/lib/payroll/run-readiness';
import { describePayrollRunStatus } from '@/lib/payroll/payroll-run-status';
import {
  filterPayrollExportItems,
  summarizePayrollHeadcount,
} from '@/lib/payroll/export-eligibility.core';
import { buildExportPreflight } from '@/lib/payroll/export-preflight';
import {
  isPayrollEligibleCommissionSale,
  planPayrollCommission,
} from '@/lib/services/payrollCommission.core';
import { summarizeCommissionAmounts } from '@/lib/services/commissionSummary.core';

/**
 * ARGUS #383: service-level rules that previously had no test at all. These
 * exercise the same pure helpers the payroll service, routes and page use.
 */

describe('payroll no-pay contribution base', () => {
  it('computes EPF/ETF on earnings after the no-pay deduction, not on gross', () => {
    const result = calculatePayroll({
      basicSalary: 52000,
      allowances: 0,
      overtimeMinutes: 0,
      overtimeMultiplier: 1.5,
      workingDays: 26,
      commissionAmount: 0,
      noPayDays: 2,
      advanceDeduction: 0,
    });

    expect(result.grossSalary).toBe('52000.00');
    // Gross-based EPF would be 4,160.00; the reduced base is 48,000.00.
    expect(result.employeeEpf).toBe('3840.00');
    expect(result.employerEpf).toBe('5760.00');
    expect(result.employerEtf).toBe('1440.00');
  });

  it('keeps gross - net equal to no-pay + advances + employee EPF', () => {
    const result = calculatePayroll({
      basicSalary: 60000,
      allowances: 5000,
      overtimeMinutes: 120,
      overtimeMultiplier: 1.5,
      workingDays: 26,
      commissionAmount: 2500,
      noPayDays: 1.5,
      advanceDeduction: 3000,
    });

    const deductions = Number(result.totalDeductions) + Number(result.employeeEpf);
    expect(Number(result.grossSalary) - Number(result.netSalary)).toBeCloseTo(deductions, 2);
  });
});

describe('zero-run prevention', () => {
  it('hard-blocks a month with no active staff', () => {
    const readiness = assessPayrollRunReadiness([]);
    expect(readiness.blocking?.code).toBe('NO_STAFF');
    expect(readiness.requiresConfirmation).toBe(false);
  });

  it('requires confirmation when every row pays zero', () => {
    const readiness = assessPayrollRunReadiness([
      {
        userId: 'u1',
        staffName: 'Saman Perera',
        basicSalary: 0,
        allowances: 0,
        grossSalary: 0,
        netSalary: 0,
        hasSalaryConfig: false,
      },
    ]);
    expect(readiness.blocking).toBeNull();
    expect(readiness.requiresConfirmation).toBe(true);
    expect(readiness.warnings.map((warning) => warning.code)).toEqual([
      'ALL_ZERO_PAY',
      'UNSALARIED_STAFF',
    ]);
  });

  it('does not require confirmation for a normal payable run', () => {
    const readiness = assessPayrollRunReadiness([
      {
        userId: 'u1',
        staffName: 'Saman Perera',
        basicSalary: 50000,
        allowances: 0,
        grossSalary: 50000,
        netSalary: 44000,
        hasSalaryConfig: true,
      },
    ]);
    expect(readiness.blocking).toBeNull();
    expect(readiness.requiresConfirmation).toBe(false);
    expect(readiness.totalNet).toBe('44000.00');
  });
});

describe('returned-sale commission consumption', () => {
  it('nets a return clawback against the open commission to be reserved', () => {
    const plan = planPayrollCommission([
      {
        id: 'earned',
        earnedAmount: 1000,
        paidAmount: 0,
        createdAt: new Date('2026-11-01'),
      },
      {
        id: 'return-adjustment',
        earnedAmount: -400,
        paidAmount: 0,
        createdAt: new Date('2026-11-10'),
      },
    ]);

    expect(plan.netOutstanding.toFixed(2)).toBe('600.00');
    expect(plan.payable.toFixed(2)).toBe('600.00');
    expect(plan.records.map((record) => record.id)).toEqual(['earned', 'return-adjustment']);
  });

  it('never reserves a net-negative balance', () => {
    const plan = planPayrollCommission([
      {
        id: 'return-adjustment',
        earnedAmount: -250,
        paidAmount: 0,
        createdAt: new Date('2026-11-10'),
      },
    ]);
    expect(plan.netOutstanding.toFixed(2)).toBe('-250.00');
    expect(plan.payable.toFixed(2)).toBe('0.00');
  });

  it('excludes voided sales but keeps returned sales eligible', () => {
    expect(isPayrollEligibleCommissionSale('VOIDED')).toBe(false);
    expect(isPayrollEligibleCommissionSale('RETURNED')).toBe(true);
    expect(isPayrollEligibleCommissionSale('COMPLETED')).toBe(true);
  });

  it('does not let a legacy isPaid flag hide unpaid money', () => {
    const totals = summarizeCommissionAmounts([
      { earnedAmount: 1000, paidAmount: 0, isPaid: true },
      { earnedAmount: 500, paidAmount: 500, isPaid: true },
    ]);
    expect(totals.totalPaid).toBe('500.00');
    expect(totals.unpaid).toBe('1000.00');
    expect(totals.counts.unpaid).toBe(1);
  });
});

describe('run status and payment display', () => {
  it('calls a generated run unpaid and payable', () => {
    const display = describePayrollRunStatus({ status: 'GENERATED' });
    expect(display.statusLabel).toBe('Unpaid');
    expect(display.netLabel).toBe('Net payable');
    expect(display.exportMarker).toContain('UNPAID');
  });

  it('calls a paid run paid and shows the payment audit detail', () => {
    const display = describePayrollRunStatus({
      status: 'PAID',
      payment: {
        paidAt: '2026-11-30T09:15:00.000Z',
        approvedBy: 'Nimal Silva',
        approvedByRole: 'OWNER',
        source: 'audit-log',
      },
    });
    expect(display.statusLabel).toBe('Paid');
    expect(display.netLabel).toBe('Net salaries paid');
    expect(display.statusDetail).toContain('Nimal Silva');
    expect(display.exportMarker).toContain('PAID');
  });
});

describe('export completeness', () => {
  const items = [
    {
      staffName: 'Paid Staff',
      grossSalary: '40000.00',
      netSalary: '36000.00',
      employeeEpf: '3200.00',
      employerEpf: '4800.00',
      employerEtf: '1200.00',
    },
    {
      staffName: 'Zero Staff',
      grossSalary: '0.00',
      netSalary: '0.00',
      employeeEpf: '0.00',
      employerEpf: '0.00',
      employerEtf: '0.00',
    },
  ];

  it('drops zero-earnings rows from bank and statutory files but keeps them in the summary', () => {
    expect(filterPayrollExportItems(items, 'bank-sheet').map((row) => row.staffName)).toEqual([
      'Paid Staff',
    ]);
    expect(filterPayrollExportItems(items, 'statutory')).toHaveLength(1);
    expect(filterPayrollExportItems(items, 'summary')).toHaveLength(2);
    expect(summarizePayrollHeadcount(items)).toEqual({
      total: 2,
      paid: 1,
      zeroEarnings: 1,
      statutory: 1,
    });
  });

  it('flags blank bank and statutory fields before a download', () => {
    const bank = buildExportPreflight({
      kind: 'bank-sheet',
      staff: [{ staffName: 'Paid Staff', bankName: '', bankAccountNumber: null }],
    });
    expect(bank.complete).toBe(false);
    expect(bank.affectedStaff[0]?.missingFields).toEqual([
      'Bank name',
      'Bank account number',
    ]);

    const statutory = buildExportPreflight({
      kind: 'statutory',
      staff: [{ staffName: 'Paid Staff', nic: '199012345678', epfNumber: '', etfNumber: '' }],
      employerEpfNumber: '',
      employerEtfNumber: '',
    });
    expect(statutory.complete).toBe(false);
    expect(statutory.employerMissing).toEqual([
      'Employer EPF number',
      'Employer ETF number',
    ]);
  });

  it('treats the summary as complete because it needs no identity fields', () => {
    const summary = buildExportPreflight({
      kind: 'summary',
      staff: [{ staffName: 'Paid Staff' }],
    });
    expect(summary.complete).toBe(true);
  });
});
