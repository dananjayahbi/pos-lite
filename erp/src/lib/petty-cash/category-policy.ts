import { EXPENSE_CATEGORIES } from '@/lib/validators/expense.validators';

/**
 * ARGUS #407 - a fund's Active Categories are a server-side allow-list for
 * petty-cash-linked expenses, not a display hint.
 *
 * The Expenses form only offers the enabled set when a fund is selected, and
 * the expense service rejects a linked create/update that names a disabled
 * category. `null`/`undefined` means "no fund configuration loaded" and is
 * treated as unrestricted; an empty array means every category is disabled.
 */
export interface FundCategoryDecision {
  allowed: boolean;
  reason: string | null;
}

export function isCategoryEnabledForFund(
  category: string,
  activeCategories: readonly string[] | null | undefined,
): boolean {
  if (activeCategories === null || activeCategories === undefined) return true;
  return activeCategories.includes(category);
}

export function categoryDenialReason(
  category: string,
  activeCategories: readonly string[] | null | undefined,
): string | null {
  if (isCategoryEnabledForFund(category, activeCategories)) return null;
  return `The selected petty-cash fund does not enable the ${category} category`;
}

/**
 * The form's category list when a fund is selected: only enabled categories,
 * in the canonical `EXPENSE_CATEGORIES` order. Falls back to the full list when
 * no fund configuration is loaded.
 */
export function selectFormExpenseCategories(
  activeCategories: readonly string[] | null | undefined,
): string[] {
  if (activeCategories === null || activeCategories === undefined) {
    return [...EXPENSE_CATEGORIES];
  }
  return EXPENSE_CATEGORIES.filter((category) => activeCategories.includes(category));
}
