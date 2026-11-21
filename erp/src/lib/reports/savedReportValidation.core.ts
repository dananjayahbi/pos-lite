/**
 * Saved-report name rules (ARGUS #448).
 *
 * The POST validator uses `zSafeShortText(100)`, but rename only checked
 * "non-empty". The same rules are now exposed as a pure helper so the rename
 * dialog can disable Save and explain the problem before a round-trip, while
 * the server keeps the authoritative check.
 */
export const SAVED_REPORT_NAME_MAX_LENGTH = 100;

const UNSAFE_NAME_CHARS = /[<>`]/;

export type SavedReportNameError = 'required' | 'too-long' | 'unsafe-characters';

export interface SavedReportNameResult {
  ok: boolean;
  /** Trimmed name, always present even when invalid (for display). */
  name: string;
  error: SavedReportNameError | null;
  message: string | null;
}

export function validateSavedReportName(value: unknown): SavedReportNameResult {
  const name = typeof value === 'string' ? value.trim() : '';

  if (name.length === 0) {
    return {
      ok: false,
      name,
      error: 'required',
      message: 'Name is required',
    };
  }
  if (name.length > SAVED_REPORT_NAME_MAX_LENGTH) {
    return {
      ok: false,
      name,
      error: 'too-long',
      message: `Name must be ${SAVED_REPORT_NAME_MAX_LENGTH} characters or fewer`,
    };
  }
  if (UNSAFE_NAME_CHARS.test(name)) {
    return {
      ok: false,
      name,
      error: 'unsafe-characters',
      message: 'Name must not contain < > or ` characters',
    };
  }
  return { ok: true, name, error: null, message: null };
}
