/**
 * ARGUS #411 - fund settings need a full diff and a real dirty check.
 *
 * The previous audit recorded only name/opening/isActive and omitted the
 * threshold/categories, and the UI allowed Save before anything changed. This
 * module keeps the comparison pure and order-insensitive for categories.
 */
export type FundSettingField =
  | 'name'
  | 'openingBalance'
  | 'lowBalanceThreshold'
  | 'isActive'
  | 'activeCategories';

export interface FundSettingsSnapshot {
  name: string;
  openingBalance: number;
  lowBalanceThreshold: number | null;
  isActive: boolean;
  activeCategories: string[];
}

export interface FundSettingsSource {
  name: string;
  openingBalance: string | number | { toString(): string };
  lowBalanceThreshold?: string | number | { toString(): string } | null;
  isActive: boolean;
  activeCategories: readonly string[];
}

function toNumber(value: string | number | { toString(): string }): number {
  const numeric = typeof value === 'number' ? value : Number(value.toString());
  return Number.isFinite(numeric) ? numeric : 0;
}

export function sameCategorySet(
  left: readonly string[],
  right: readonly string[],
): boolean {
  if (left.length !== right.length) return false;
  const leftSet = new Set(left);
  return right.every((category) => leftSet.has(category));
}

export function fundSettingsSnapshot(fund: FundSettingsSource): FundSettingsSnapshot {
  return {
    name: fund.name,
    openingBalance: toNumber(fund.openingBalance),
    lowBalanceThreshold:
      fund.lowBalanceThreshold === null || fund.lowBalanceThreshold === undefined
        ? null
        : toNumber(fund.lowBalanceThreshold),
    isActive: fund.isActive,
    activeCategories: [...fund.activeCategories],
  };
}

export interface FundSettingsDiff {
  changed: boolean;
  changedFields: FundSettingField[];
  before: FundSettingsSnapshot;
  after: FundSettingsSnapshot;
}

export function diffFundSettings(
  before: FundSettingsSnapshot,
  after: FundSettingsSnapshot,
): FundSettingsDiff {
  const changedFields: FundSettingField[] = [];
  if (before.name !== after.name) changedFields.push('name');
  if (before.openingBalance !== after.openingBalance) changedFields.push('openingBalance');
  if (before.lowBalanceThreshold !== after.lowBalanceThreshold) {
    changedFields.push('lowBalanceThreshold');
  }
  if (before.isActive !== after.isActive) changedFields.push('isActive');
  if (!sameCategorySet(before.activeCategories, after.activeCategories)) {
    changedFields.push('activeCategories');
  }
  return {
    changed: changedFields.length > 0,
    changedFields,
    before,
    after,
  };
}

export interface FundSettingsDraft {
  name: string;
  lowBalanceThreshold: number | null;
}

export function isFundSettingsDraftDirty(
  initial: FundSettingsDraft,
  draft: FundSettingsDraft,
): boolean {
  return (
    initial.name.trim() !== draft.name.trim() ||
    initial.lowBalanceThreshold !== draft.lowBalanceThreshold
  );
}

export function isCategorySelectionDirty(
  initial: readonly string[],
  pending: readonly string[] | null,
): boolean {
  return pending !== null && !sameCategorySet(initial, pending);
}
