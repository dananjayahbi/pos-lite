import { describe, expect, it } from 'vitest';

import {
  PASSWORD_MAX_BYTES,
  PASSWORD_MAX_MESSAGE,
  PASSWORD_MIN_MESSAGE,
  PASSWORD_SAME_MESSAGE,
  passwordByteLength,
  validatePasswordChange,
} from '@/lib/auth/password-policy.core';

/** ARGUS #505: length floor, bcrypt's 72-byte ceiling and same-password rule. */
describe('passwordByteLength', () => {
  it('counts UTF-8 bytes, not UTF-16 code units', () => {
    expect(passwordByteLength('abc')).toBe(3);
    // Four-byte emoji: 2 UTF-16 units but 4 bcrypt bytes.
    expect(passwordByteLength('😀')).toBe(4);
  });
});

describe('validatePasswordChange', () => {
  const current = 'current-password-1';

  it('accepts a valid change', () => {
    expect(
      validatePasswordChange({
        currentPassword: current,
        newPassword: 'a-new-strong-password',
        confirmPassword: 'a-new-strong-password',
      }),
    ).toEqual({ ok: true, errors: {} });
  });

  it('rejects a missing current password with a friendly message', () => {
    const result = validatePasswordChange({
      currentPassword: '',
      newPassword: 'a-new-strong-password',
      confirmPassword: 'a-new-strong-password',
    });
    expect(result.ok).toBe(false);
    expect(result.errors.currentPassword).toBe('Current password is required');
  });

  it('requires at least 8 characters', () => {
    const result = validatePasswordChange({
      currentPassword: current,
      newPassword: 'short',
      confirmPassword: 'short',
    });
    expect(result.errors.newPassword).toBe(PASSWORD_MIN_MESSAGE);
  });

  it('caps the password at 72 bytes instead of letting bcrypt truncate', () => {
    const atLimit = 'x'.repeat(PASSWORD_MAX_BYTES);
    expect(
      validatePasswordChange({
        currentPassword: current,
        newPassword: atLimit,
        confirmPassword: atLimit,
      }).ok,
    ).toBe(true);

    const overLimit = `${atLimit}x`;
    const result = validatePasswordChange({
      currentPassword: current,
      newPassword: overLimit,
      confirmPassword: overLimit,
    });
    expect(result.errors.newPassword).toBe(PASSWORD_MAX_MESSAGE);

    // 24 four-byte emoji = 96 bytes even though the string is 48 UTF-16 units.
    const emoji = '😀'.repeat(24);
    expect(
      validatePasswordChange({
        currentPassword: current,
        newPassword: emoji,
        confirmPassword: emoji,
      }).errors.newPassword,
    ).toBe(PASSWORD_MAX_MESSAGE);
  });

  it('rejects the current password as the new password', () => {
    const result = validatePasswordChange({
      currentPassword: current,
      newPassword: current,
      confirmPassword: current,
    });
    expect(result.errors.newPassword).toBe(PASSWORD_SAME_MESSAGE);
  });

  it('checks the confirmation only when supplied', () => {
    expect(
      validatePasswordChange({
        currentPassword: current,
        newPassword: 'a-new-strong-password',
      }).ok,
    ).toBe(true);
    expect(
      validatePasswordChange({
        currentPassword: current,
        newPassword: 'a-new-strong-password',
        confirmPassword: 'different',
      }).errors.confirmPassword,
    ).toBe('Passwords do not match');
  });
});
