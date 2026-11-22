import { describe, expect, it } from 'vitest';
import {
  assessPayrollRunReadiness,
  listStaffNames,
  type PayrollReadinessRow,
} from '@/lib/payroll/run-readiness';

function row(patch: Partial<PayrollReadinessRow> = {}): PayrollReadinessRow {
  return {
    userId: 'u1',
    staffName: 'Amara Perera',
    basicSalary: '50000.00',
    allowances: '0.00',
    grossSalary: '50000.00',
    netSalary: '44000.00',
    hasSalaryConfig: true,
    ...patch,
  };
}

describe('assessPayrollRunReadiness', () => {
  it('blocks a month with no active staff', () => {
    const readiness = assessPayrollRunReadiness([]);
    expect(readiness.blocking?.code).toBe('NO_STAFF');
    expect(readiness.hasPayableStaff).toBe(false);
    expect(readiness.warnings).toEqual([]);
    expect(readiness.requiresConfirmation).toBe(false);
  });

  it('accepts a normal run without confirmation', () => {
    const readiness = assessPayrollRunReadiness([row()]);
    expect(readiness.blocking).toBeNull();
    expect(readiness.hasPayableStaff).toBe(true);
    expect(readiness.payableStaffCount).toBe(1);
    expect(readiness.totalNet).toBe('44000.00');
    expect(readiness.requiresConfirmation).toBe(false);
    expect(readiness.confirmationMessage).toBeNull();
  });

  it('requires confirmation when every employee is paid zero', () => {
    const readiness = assessPayrollRunReadiness([
      row({ userId: 'u1', staffName: 'Amara', basicSalary: 0, grossSalary: 0, netSalary: 0 }),
      row({ userId: 'u2', staffName: 'Bimal', basicSalary: 0, grossSalary: 0, netSalary: 0 }),
    ]);

    expect(readiness.blocking).toBeNull();
    expect(readiness.hasPayableStaff).toBe(false);
    expect(readiness.zeroPayStaff).toHaveLength(2);
    expect(readiness.warnings.map((warning) => warning.code)).toEqual(['ALL_ZERO_PAY']);
    expect(readiness.requiresConfirmation).toBe(true);
    expect(readiness.confirmationMessage).toContain('Rs 0.00');
  });

  it('flags unsalaried staff even when the run has payable employees', () => {
    const readiness = assessPayrollRunReadiness([
      row({ userId: 'u1', staffName: 'Amara' }),
      row({
        userId: 'u2',
        staffName: 'Bimal',
        basicSalary: 0,
        allowances: 0,
        grossSalary: 0,
        netSalary: 0,
        hasSalaryConfig: false,
      }),
    ]);

    expect(readiness.hasPayableStaff).toBe(true);
    expect(readiness.payableStaffCount).toBe(1);
    expect(readiness.unsalariedStaff).toEqual([{ userId: 'u2', staffName: 'Bimal' }]);
    expect(readiness.warnings.map((warning) => warning.code)).toEqual([
      'UNSALARIED_STAFF',
    ]);
    expect(readiness.requiresConfirmation).toBe(true);
    expect(readiness.confirmationMessage).toContain('Bimal');
  });

  it('requires confirmation when the gross is paid away to zero by no-pay days', () => {
    const readiness = assessPayrollRunReadiness([
      row({ basicSalary: 26000, grossSalary: 26000, netSalary: 0 }),
    ]);

    expect(readiness.hasPayableStaff).toBe(true);
    expect(readiness.zeroPayStaff).toEqual([{ userId: 'u1', staffName: 'Amara Perera' }]);
    expect(readiness.warnings.map((warning) => warning.code)).toEqual(['ALL_ZERO_PAY']);
  });

  it('treats malformed money values as zero instead of NaN', () => {
    const readiness = assessPayrollRunReadiness([
      row({ grossSalary: 'not-a-number', netSalary: 'not-a-number' }),
    ]);
    expect(readiness.totalNet).toBe('0.00');
    expect(readiness.hasPayableStaff).toBe(false);
  });
});

describe('listStaffNames', () => {
  it('lists a short set in full', () => {
    expect(
      listStaffNames([
        { userId: '1', staffName: 'Amara' },
        { userId: '2', staffName: 'Bimal' },
      ]),
    ).toBe('Amara, Bimal');
  });

  it('summarises a long set', () => {
    expect(
      listStaffNames(
        ['A', 'B', 'C', 'D'].map((name, index) => ({
          userId: String(index),
          staffName: name,
        })),
        2,
      ),
    ).toBe('A, B and 2 more');
  });
});
