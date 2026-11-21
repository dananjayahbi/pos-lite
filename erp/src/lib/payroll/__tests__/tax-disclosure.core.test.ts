import { describe, expect, it } from 'vitest';
import {
  PAYROLL_TAX_NOT_CONFIGURED_MESSAGE,
  describePayrollTaxTreatment,
} from '@/lib/payroll/tax-disclosure.core';

describe('payroll tax disclosure', () => {
  it('states that PAYE/APIT is not configured without fabricating a rate', () => {
    const treatment = describePayrollTaxTreatment();
    expect(treatment.configured).toBe(false);
    expect(treatment.label).toContain('PAYE/APIT');
    expect(treatment.message).toBe(PAYROLL_TAX_NOT_CONFIGURED_MESSAGE);
    expect(treatment.message).toContain('not configured');
    expect(treatment.message).toContain('no income tax has been withheld');
    expect(treatment.message).not.toMatch(/\d+(\.\d+)?\s*%/);
  });

  it('keeps the net-pay formula explicit', () => {
    expect(PAYROLL_TAX_NOT_CONFIGURED_MESSAGE).toContain(
      'Net pay = gross - (no-pay + advances) - employee EPF',
    );
  });
});
