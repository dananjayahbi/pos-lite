import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PAYROLL_SETTINGS,
  parsePayrollSettings,
  readPayrollSettingsFromTenantSettings,
  resolveWorkingDays,
} from '@/lib/payroll/payroll-settings';

describe('parsePayrollSettings', () => {
  it('returns defaults when nothing is configured', () => {
    expect(parsePayrollSettings(undefined)).toEqual(DEFAULT_PAYROLL_SETTINGS);
    expect(parsePayrollSettings(null)).toEqual(DEFAULT_PAYROLL_SETTINGS);
    expect(parsePayrollSettings('bad')).toEqual(DEFAULT_PAYROLL_SETTINGS);
  });

  it('keeps valid values', () => {
    expect(
      parsePayrollSettings({
        employerEpfNumber: ' EPF-001 ',
        employerEtfNumber: 'ETF-002',
        workingDays: 24,
        overtimeMultiplier: 2,
      }),
    ).toEqual({
      employerEpfNumber: 'EPF-001',
      employerEtfNumber: 'ETF-002',
      workingDays: 24,
      overtimeMultiplier: 2,
    });
  });

  it('clamps out-of-range values back to defaults', () => {
    const parsed = parsePayrollSettings({
      workingDays: 99,
      overtimeMultiplier: 9,
    });
    expect(parsed.workingDays).toBe(0);
    expect(parsed.overtimeMultiplier).toBe(1.5);
  });
});

describe('readPayrollSettingsFromTenantSettings', () => {
  it('reads the nested payroll block', () => {
    const parsed = readPayrollSettingsFromTenantSettings({
      vatRate: 18,
      payroll: { employerEpfNumber: 'E-1', workingDays: 22 },
    });
    expect(parsed.employerEpfNumber).toBe('E-1');
    expect(parsed.workingDays).toBe(22);
  });
});

describe('resolveWorkingDays', () => {
  it('prefers the configured working days', () => {
    expect(resolveWorkingDays({ ...DEFAULT_PAYROLL_SETTINGS, workingDays: 24 }, 21)).toBe(24);
  });

  it('uses the calendar count when configured as 0', () => {
    expect(resolveWorkingDays(DEFAULT_PAYROLL_SETTINGS, 21)).toBe(21);
  });

  it('falls back to 26 for a non-positive calendar count', () => {
    expect(resolveWorkingDays(DEFAULT_PAYROLL_SETTINGS, 0)).toBe(26);
  });
});
