import { describe, expect, it } from 'vitest';

import {
  SAVED_REPORT_NAME_MAX_LENGTH,
  validateSavedReportName,
} from '@/lib/reports/savedReportValidation.core';

/** ARGUS #448: rename must follow the same name rule as POST. */
describe('validateSavedReportName', () => {
  it('accepts and trims a normal name', () => {
    expect(validateSavedReportName('  Monthly Sales  ')).toEqual({
      ok: true,
      name: 'Monthly Sales',
      error: null,
      message: null,
    });
  });

  it('rejects empty or whitespace-only names', () => {
    expect(validateSavedReportName('').error).toBe('required');
    expect(validateSavedReportName('   ').error).toBe('required');
    expect(validateSavedReportName(undefined).error).toBe('required');
  });

  it('enforces the 100-character limit shared with POST', () => {
    const atLimit = 'a'.repeat(SAVED_REPORT_NAME_MAX_LENGTH);
    expect(validateSavedReportName(atLimit).ok).toBe(true);

    const tooLong = validateSavedReportName('a'.repeat(SAVED_REPORT_NAME_MAX_LENGTH + 1));
    expect(tooLong.error).toBe('too-long');
    expect(tooLong.message).toContain(String(SAVED_REPORT_NAME_MAX_LENGTH));
  });

  it('rejects markup characters instead of stripping them', () => {
    expect(validateSavedReportName('<script>alert(1)</script>').error).toBe('unsafe-characters');
    expect(validateSavedReportName('Sales `draft`').error).toBe('unsafe-characters');
  });

  it('accepts punctuation that is safe in a filename/label', () => {
    expect(validateSavedReportName("October's P&L (final) - v2").ok).toBe(true);
  });
});
