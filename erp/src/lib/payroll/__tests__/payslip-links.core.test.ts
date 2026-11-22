import { describe, expect, it } from 'vitest';
import { payslipUrl, wantsInlinePayslip } from '@/lib/payroll/payslip-links.core';

describe('payslip links', () => {
  it('separates print/view from download', () => {
    expect(payslipUrl('run 1', 'user/2', 'view')).toBe(
      '/api/store/payroll/runs/run%201/payslips/user%2F2?disposition=inline',
    );
    expect(payslipUrl('run 1', 'user/2')).toBe(
      '/api/store/payroll/runs/run%201/payslips/user%2F2',
    );
    expect(payslipUrl('run-1', 'user-2', 'view')).not.toBe(payslipUrl('run-1', 'user-2'));
  });

  it('only treats an explicit inline disposition as a view', () => {
    expect(wantsInlinePayslip('inline')).toBe(true);
    expect(wantsInlinePayslip(' INLINE ')).toBe(true);
    expect(wantsInlinePayslip('attachment')).toBe(false);
    expect(wantsInlinePayslip(null)).toBe(false);
  });
});
