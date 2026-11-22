import { describe, expect, it } from 'vitest';
import {
  filterPayrollExportItems,
  isBankPayable,
  isStatutoryReportable,
  summarizePayrollHeadcount,
  type PayrollEligibilityItem,
} from '@/lib/payroll/export-eligibility.core';

function item(patch: Partial<PayrollEligibilityItem> = {}): PayrollEligibilityItem {
  return {
    staffName: 'Amara',
    grossSalary: '50000.00',
    netSalary: '44000.00',
    employeeEpf: '4000.00',
    employerEpf: '6000.00',
    employerEtf: '1500.00',
    ...patch,
  };
}

const zero = item({
  staffName: 'Zero',
  grossSalary: '0.00',
  netSalary: '0.00',
  employeeEpf: '0.00',
  employerEpf: '0.00',
  employerEtf: '0.00',
});

describe('payroll export eligibility', () => {
  it('excludes zero-earnings rows from the bank worksheet', () => {
    const rows = filterPayrollExportItems([item(), zero], 'bank-sheet');
    expect(rows.map((row) => row.staffName)).toEqual(['Amara']);
  });

  it('keeps a zero-net row on the statutory return when contributions exist', () => {
    const advanceSettled = item({
      staffName: 'Advance',
      netSalary: '0.00',
      employeeEpf: '4000.00',
    });
    expect(isBankPayable(advanceSettled)).toBe(false);
    expect(isStatutoryReportable(advanceSettled)).toBe(true);
    expect(
      filterPayrollExportItems([advanceSettled, zero], 'statutory').map(
        (row) => row.staffName,
      ),
    ).toEqual(['Advance']);
  });

  it('never filters the summary scope', () => {
    expect(filterPayrollExportItems([item(), zero], 'summary')).toHaveLength(2);
  });

  it('reports paid, statutory and zero-earnings headcount separately', () => {
    const advanceSettled = item({
      staffName: 'Advance',
      netSalary: '0.00',
      employeeEpf: '4000.00',
    });
    expect(summarizePayrollHeadcount([item(), advanceSettled, zero])).toEqual({
      total: 3,
      paid: 1,
      zeroEarnings: 1,
      statutory: 2,
    });
  });
});
