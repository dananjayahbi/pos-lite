import { describe, expect, it } from 'vitest';
import {
  buildExportPreflight,
  type PayrollExportStaffRow,
} from '@/lib/payroll/export-preflight';

function staff(patch: Partial<PayrollExportStaffRow> = {}): PayrollExportStaffRow {
  return {
    staffName: 'Amara Perera',
    bankName: 'Commercial Bank',
    bankAccountNumber: '8001234567',
    nic: '199012345678',
    epfNumber: 'EPF-001',
    etfNumber: 'ETF-001',
    ...patch,
  };
}

describe('buildExportPreflight - bank sheet', () => {
  it('passes when every employee has a bank and account number', () => {
    const preflight = buildExportPreflight({
      kind: 'bank-sheet',
      staff: [staff(), staff({ staffName: 'Bimal' })],
    });
    expect(preflight.complete).toBe(true);
    expect(preflight.affectedStaffCount).toBe(0);
    expect(preflight.message).toBeNull();
  });

  it('lists each employee missing bank details', () => {
    const preflight = buildExportPreflight({
      kind: 'bank-sheet',
      staff: [
        staff(),
        staff({ staffName: 'Bimal', bankName: null, bankAccountNumber: '  ' }),
      ],
    });
    expect(preflight.complete).toBe(false);
    expect(preflight.affectedStaffCount).toBe(1);
    expect(preflight.affectedStaff).toEqual([
      {
        staffName: 'Bimal',
        missingFields: ['Bank name', 'Bank account number'],
      },
    ]);
    expect(preflight.missingFieldCount).toBe(2);
    expect(preflight.message).toContain('missing Bank name, Bank account number');
    expect(preflight.message).toContain('1 of 2 employees');
  });

  it('treats an empty staff list as complete but empty', () => {
    const preflight = buildExportPreflight({ kind: 'bank-sheet', staff: [] });
    expect(preflight.complete).toBe(true);
    expect(preflight.staffCount).toBe(0);
  });
});

describe('buildExportPreflight - statutory', () => {
  it('requires NIC and both statutory numbers per employee', () => {
    const preflight = buildExportPreflight({
      kind: 'statutory',
      staff: [staff({ nic: '', epfNumber: null, etfNumber: 'ETF-009' })],
      employerEpfNumber: 'E-EPF',
      employerEtfNumber: 'E-ETF',
    });

    expect(preflight.complete).toBe(false);
    expect(preflight.affectedStaff[0]?.missingFields).toEqual([
      'NIC (C-form)',
      'EPF number (C-form)',
    ]);
    expect(preflight.missingFieldCount).toBe(2);
  });

  it('blocks the return when the employer numbers are not configured', () => {
    const preflight = buildExportPreflight({
      kind: 'statutory',
      staff: [staff()],
      employerEpfNumber: 'E-EPF',
      employerEtfNumber: '   ',
    });

    expect(preflight.complete).toBe(false);
    expect(preflight.affectedStaffCount).toBe(0);
    expect(preflight.employerMissing).toEqual(['Employer ETF number']);
    expect(preflight.message).toContain('Not configured: Employer ETF number.');
  });

  it('passes a fully configured C-form and ETF return', () => {
    const preflight = buildExportPreflight({
      kind: 'statutory',
      staff: [staff(), staff({ staffName: 'Bimal' })],
      employerEpfNumber: 'E-EPF',
      employerEtfNumber: 'E-ETF',
    });
    expect(preflight.complete).toBe(true);
    expect(preflight.message).toBeNull();
  });
});

describe('buildExportPreflight - summary', () => {
  it('never blocks the company cost summary', () => {
    const preflight = buildExportPreflight({
      kind: 'summary',
      staff: [staff({ bankName: null, nic: null, epfNumber: null, etfNumber: null })],
      employerEpfNumber: '',
      employerEtfNumber: '',
    });
    expect(preflight.complete).toBe(true);
    expect(preflight.message).toBeNull();
  });
});
