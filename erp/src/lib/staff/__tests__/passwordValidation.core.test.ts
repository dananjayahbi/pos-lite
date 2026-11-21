import { describe, expect, it } from 'vitest';

import {
  STAFF_PASSWORD_MIN_LENGTH,
  validateStaffPassword,
} from '@/lib/staff/passwordValidation.core';

/** ARGUS #339 — the Set/Reset Password dialog validates before submit. */
describe('validateStaffPassword', () => {
  it('accepts a password that meets the length and matches', () => {
    expect(
      validateStaffPassword({ newPassword: 'longenough', confirmPassword: 'longenough' }),
    ).toEqual({ ok: true });
  });

  it('accepts a password at exactly the minimum length', () => {
    const password = 'a'.repeat(STAFF_PASSWORD_MIN_LENGTH);
    expect(validateStaffPassword({ newPassword: password, confirmPassword: password })).toEqual({
      ok: true,
    });
  });

  it('rejects an empty password', () => {
    const result = validateStaffPassword({ newPassword: '', confirmPassword: '' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.field).toBe('newPassword');
  });

  it('rejects a short password with the minimum length in the message', () => {
    const result = validateStaffPassword({ newPassword: 'short', confirmPassword: 'short' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.field).toBe('newPassword');
      expect(result.message).toContain(String(STAFF_PASSWORD_MIN_LENGTH));
    }
  });

  it('rejects a mismatched confirmation', () => {
    const result = validateStaffPassword({
      newPassword: 'longenough',
      confirmPassword: 'longenough2',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.field).toBe('confirmPassword');
      expect(result.message).toBe('Passwords do not match');
    }
  });

  it('does not trim passwords (spaces can be intentional)', () => {
    expect(
      validateStaffPassword({ newPassword: '  12345678  ', confirmPassword: '  12345678  ' }),
    ).toEqual({ ok: true });
  });
});
