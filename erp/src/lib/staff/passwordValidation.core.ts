/**
 * Staff password validation (ARGUS #339).
 *
 * The API enforces a minimum length; these rules keep the dialog honest before
 * submitting and add the confirmation check that only exists client-side. The
 * password itself is never trimmed, logged or persisted anywhere outside the
 * API call.
 */

export const STAFF_PASSWORD_MIN_LENGTH = 8;

export interface StaffPasswordFormValues {
  newPassword: string;
  confirmPassword: string;
}

export type StaffPasswordValidation =
  | { ok: true }
  | { ok: false; field: 'newPassword' | 'confirmPassword'; message: string };

export function validateStaffPassword(
  values: StaffPasswordFormValues,
): StaffPasswordValidation {
  if (values.newPassword.length === 0) {
    return { ok: false, field: 'newPassword', message: 'Enter a new password' };
  }

  if (values.newPassword.length < STAFF_PASSWORD_MIN_LENGTH) {
    return {
      ok: false,
      field: 'newPassword',
      message: `Password must be at least ${STAFF_PASSWORD_MIN_LENGTH} characters`,
    };
  }

  if (values.confirmPassword !== values.newPassword) {
    return { ok: false, field: 'confirmPassword', message: 'Passwords do not match' };
  }

  return { ok: true };
}
