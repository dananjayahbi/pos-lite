/**
 * Self-service password policy (ARGUS #505).
 *
 * The only rule used to be "at least 8 characters". bcrypt hashes at most 72
 * BYTES and silently ignores the rest, so an 80-character password compared
 * true against the first 72 characters plus any suffix. The API also accepted
 * a new password equal to the current one (only the form blocked it), and an
 * empty payload surfaced zod's raw default message.
 *
 * One helper now owns the rules so the form and the route cannot drift.
 */

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_BYTES = 72;

export const PASSWORD_REQUIRED_MESSAGE = 'Current password is required';
export const PASSWORD_MIN_MESSAGE = 'New password must be at least 8 characters';
export const PASSWORD_MAX_MESSAGE =
  'New password must be at most 72 bytes (about 72 characters)';
export const PASSWORD_SAME_MESSAGE =
  'New password must be different from the current password';
export const PASSWORD_MATCH_MESSAGE = 'Passwords do not match';

/** Byte length using UTF-8, matching what bcrypt actually consumes. */
export function passwordByteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

export interface PasswordValidation {
  ok: boolean;
  /** Field-level messages keyed like the form/API payload. */
  errors: {
    currentPassword?: string;
    newPassword?: string;
    confirmPassword?: string;
  };
}

export interface PasswordRulesInput {
  currentPassword: string;
  newPassword: string;
  confirmPassword?: string;
}

/**
 * Validate a password change. `confirmPassword` is checked only when supplied
 * (the API makes it optional for backward compatibility but still validates it
 * when present).
 */
export function validatePasswordChange(input: PasswordRulesInput): PasswordValidation {
  const errors: PasswordValidation['errors'] = {};

  if (input.currentPassword.length === 0) {
    errors.currentPassword = PASSWORD_REQUIRED_MESSAGE;
  }

  if (input.newPassword.length < PASSWORD_MIN_LENGTH) {
    errors.newPassword = PASSWORD_MIN_MESSAGE;
  } else if (passwordByteLength(input.newPassword) > PASSWORD_MAX_BYTES) {
    errors.newPassword = PASSWORD_MAX_MESSAGE;
  } else if (input.newPassword === input.currentPassword) {
    errors.newPassword = PASSWORD_SAME_MESSAGE;
  }

  if (input.confirmPassword !== undefined && input.confirmPassword !== input.newPassword) {
    errors.confirmPassword = PASSWORD_MATCH_MESSAGE;
  }

  return { ok: Object.keys(errors).length === 0, errors };
}
