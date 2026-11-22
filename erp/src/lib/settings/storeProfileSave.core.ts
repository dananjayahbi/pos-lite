/**
 * Store Profile save gate (ARGUS #489).
 *
 * The logo upload is asynchronous. Save used to stay enabled during the
 * upload, so a click could PATCH the previous `logoUrl`; the upload then
 * completed and changed the form, leaving it dirty with the new logo unsaved.
 * The form now blocks save while an upload is in flight.
 *
 * Pure so the priority between saving, uploading, name validation and the
 * dirty check is explicit and testable.
 */

export type StoreProfileSaveBlockReason =
  | 'saving'
  | 'logo-uploading'
  | 'name-too-short'
  | 'not-dirty'
  | null;

export interface StoreProfileSaveStateInput {
  saving: boolean;
  logoUploading: boolean;
  isDirty: boolean;
  storeName: string;
}

export interface StoreProfileSaveState {
  canSave: boolean;
  reason: StoreProfileSaveBlockReason;
}

export function resolveStoreProfileSaveState(
  input: StoreProfileSaveStateInput,
): StoreProfileSaveState {
  if (input.saving) return { canSave: false, reason: 'saving' };
  if (input.logoUploading) return { canSave: false, reason: 'logo-uploading' };
  if (input.storeName.trim().length < 2) {
    return { canSave: false, reason: 'name-too-short' };
  }
  if (!input.isDirty) return { canSave: false, reason: 'not-dirty' };
  return { canSave: true, reason: null };
}

/** Disable the upload controls too while a save is committing. */
export function storeProfileControlsLocked(
  input: Pick<StoreProfileSaveStateInput, 'saving'>,
): boolean {
  return input.saving;
}

/** Browser/navigation prompt text while edits are unsaved. */
export const UNSAVED_PROFILE_PROMPT =
  'You have unsaved store profile changes. Leave without saving?';

export function unsavedProfilePrompt(isDirty: boolean): string | null {
  return isDirty ? UNSAVED_PROFILE_PROMPT : null;
}

/**
 * Why Save is disabled, in operator language. A disabled button with no
 * explanation was the ARGUS #493 complaint.
 */
export function storeProfileSaveBlockMessage(
  reason: StoreProfileSaveBlockReason,
  options: { hasFieldErrors?: boolean } = {},
): string | null {
  if (options.hasFieldErrors) return 'Fix the highlighted field before saving.';
  switch (reason) {
    case 'saving':
      return 'Saving...';
    case 'logo-uploading':
      return 'Save is disabled until the logo upload finishes.';
    case 'name-too-short':
      return 'Store name must be at least 2 characters.';
    case 'not-dirty':
      return null;
    default:
      return null;
  }
}
