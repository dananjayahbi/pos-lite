import { describe, expect, it } from 'vitest';

import {
  diffFundSettings,
  fundSettingsSnapshot,
  isCategorySelectionDirty,
  isFundSettingsDraftDirty,
  sameCategorySet,
} from '@/lib/petty-cash/fund-settings';

const base = fundSettingsSnapshot({
  name: 'Main Petty Cash',
  openingBalance: 10000,
  lowBalanceThreshold: 5000,
  isActive: true,
  activeCategories: ['TRAVEL', 'MISCELLANEOUS', 'STAFF_MEALS'],
});

describe('petty-cash fund settings diff (ARGUS #411)', () => {
  it('reports no change for an identical snapshot regardless of category order', () => {
    const same = fundSettingsSnapshot({
      name: 'Main Petty Cash',
      openingBalance: 10000,
      lowBalanceThreshold: 5000,
      isActive: true,
      activeCategories: ['STAFF_MEALS', 'TRAVEL', 'MISCELLANEOUS'],
    });
    expect(diffFundSettings(base, same)).toMatchObject({
      changed: false,
      changedFields: [],
    });
  });

  it('captures every setting family, including threshold and categories', () => {
    const after = fundSettingsSnapshot({
      name: 'Shop Float',
      openingBalance: 12000,
      lowBalanceThreshold: null,
      isActive: false,
      activeCategories: ['TRAVEL'],
    });
    expect(diffFundSettings(base, after).changedFields).toEqual([
      'name',
      'openingBalance',
      'lowBalanceThreshold',
      'isActive',
      'activeCategories',
    ]);
  });

  it('normalizes decimal strings into numbers', () => {
    expect(
      fundSettingsSnapshot({
        name: 'Float',
        openingBalance: { toString: () => '100.50' },
        lowBalanceThreshold: '25.25',
        isActive: true,
        activeCategories: [],
      }),
    ).toMatchObject({ openingBalance: 100.5, lowBalanceThreshold: 25.25 });
  });

  it('treats category order as irrelevant', () => {
    expect(sameCategorySet(['A', 'B'], ['B', 'A'])).toBe(true);
    expect(sameCategorySet(['A', 'B'], ['A'])).toBe(false);
  });
});

describe('petty-cash dirty guards (ARGUS #411)', () => {
  it('keeps Save disabled before any category toggle', () => {
    expect(isCategorySelectionDirty(['TRAVEL'], null)).toBe(false);
  });

  it('enables Save only when the pending set differs', () => {
    expect(isCategorySelectionDirty(['TRAVEL', 'MISCELLANEOUS'], ['MISCELLANEOUS', 'TRAVEL'])).toBe(
      false,
    );
    expect(isCategorySelectionDirty(['TRAVEL'], ['TRAVEL', 'MISCELLANEOUS'])).toBe(true);
  });

  it('detects settings changes and trims the name', () => {
    const initial = { name: 'Main Petty Cash', lowBalanceThreshold: 5000 };
    expect(isFundSettingsDraftDirty(initial, { ...initial, name: ' Main Petty Cash ' })).toBe(
      false,
    );
    expect(isFundSettingsDraftDirty(initial, { ...initial, name: 'Shop Float' })).toBe(true);
    expect(isFundSettingsDraftDirty(initial, { ...initial, lowBalanceThreshold: null })).toBe(
      true,
    );
  });
});
