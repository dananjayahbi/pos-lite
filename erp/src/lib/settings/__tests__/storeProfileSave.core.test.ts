import { describe, expect, it } from 'vitest';

import {
  resolveStoreProfileSaveState,
  storeProfileControlsLocked,
} from '@/lib/settings/storeProfileSave.core';

/**
 * ARGUS #489: Save must not be available while a replacement logo is uploading,
 * otherwise it persists the previous URL and the form becomes dirty again.
 */
describe('store profile save gate', () => {
  const ready = {
    saving: false,
    logoUploading: false,
    isDirty: true,
    storeName: 'Dilani Ayurveda',
  };

  it('allows save when the profile is dirty, valid and no upload is running', () => {
    expect(resolveStoreProfileSaveState(ready)).toEqual({ canSave: true, reason: null });
  });

  it('blocks save while the logo is uploading even though the form is dirty', () => {
    expect(resolveStoreProfileSaveState({ ...ready, logoUploading: true })).toEqual({
      canSave: false,
      reason: 'logo-uploading',
    });
  });

  it('blocks save while a save request is already in flight', () => {
    expect(
      resolveStoreProfileSaveState({ ...ready, saving: true, logoUploading: true }),
    ).toEqual({ canSave: false, reason: 'saving' });
  });

  it('blocks a short store name', () => {
    expect(resolveStoreProfileSaveState({ ...ready, storeName: ' A ' })).toEqual({
      canSave: false,
      reason: 'name-too-short',
    });
  });

  it('blocks a clean form', () => {
    expect(resolveStoreProfileSaveState({ ...ready, isDirty: false })).toEqual({
      canSave: false,
      reason: 'not-dirty',
    });
  });

  it('locks the upload controls only while saving', () => {
    expect(storeProfileControlsLocked({ saving: true })).toBe(true);
    expect(storeProfileControlsLocked({ saving: false })).toBe(false);
  });
});
