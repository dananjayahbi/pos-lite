import { describe, expect, it } from 'vitest';
import {
  describePayrollRunStatus,
  formatPayrollDate,
  resolveNetLabel,
} from '@/lib/payroll/payroll-run-status';

describe('resolveNetLabel', () => {
  it('only says paid after the run is PAID', () => {
    expect(resolveNetLabel('GENERATED')).toBe('Net payable');
    expect(resolveNetLabel('DRAFT')).toBe('Net payable');
    expect(resolveNetLabel('PAID')).toBe('Net salaries paid');
  });
});

describe('describePayrollRunStatus', () => {
  it('marks a generated run as unpaid', () => {
    const display = describePayrollRunStatus({ status: 'GENERATED' });
    expect(display.paid).toBe(false);
    expect(display.netLabel).toBe('Net payable');
    expect(display.statusLabel).toBe('Unpaid');
    expect(display.exportMarker).toContain('UNPAID');
    expect(display.exportMarker).toContain('not a payment confirmation');
  });

  it('shows the payment date and approver for a paid run', () => {
    const display = describePayrollRunStatus({
      status: 'PAID',
      payment: {
        paidAt: '2026-11-30T09:15:00.000Z',
        approvedBy: 'Nimal Silva',
        approvedByRole: 'OWNER',
        source: 'audit-log',
      },
    });
    expect(display.paid).toBe(true);
    expect(display.netLabel).toBe('Net salaries paid');
    expect(display.statusDetail).toContain('Paid on 30 Nov 2026');
    expect(display.statusDetail).toContain('approved by Nimal Silva');
    expect(display.exportMarker).toContain('PAID');
  });

  it('falls back to the role when the approver name is missing', () => {
    const display = describePayrollRunStatus({
      status: 'PAID',
      payment: {
        paidAt: null,
        approvedBy: null,
        approvedByRole: 'MANAGER',
        source: 'unavailable',
      },
    });
    expect(display.statusDetail).toContain('Payment date not recorded');
    expect(display.statusDetail).toContain('approved by MANAGER');
  });

  it('marks a draft run without claiming it is unpaid salary', () => {
    const display = describePayrollRunStatus({ status: 'DRAFT' });
    expect(display.statusLabel).toBe('Draft');
    expect(display.exportMarker).toContain('DRAFT');
  });

  it('treats an unknown/blank status as unpaid rather than paid', () => {
    const display = describePayrollRunStatus({ status: '' });
    expect(display.paid).toBe(false);
    expect(display.statusLabel).toBe('Unpaid');
  });
});

describe('formatPayrollDate', () => {
  it('formats valid ISO dates and rejects invalid ones', () => {
    expect(formatPayrollDate('2026-11-30T09:15:00.000Z')).toBe('30 Nov 2026');
    expect(formatPayrollDate('not-a-date')).toBeNull();
    expect(formatPayrollDate(null)).toBeNull();
  });
});
