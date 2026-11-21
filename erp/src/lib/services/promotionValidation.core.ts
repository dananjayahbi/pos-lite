/**
 * Promotion type requirements and promo-code identity (ARGUS #330).
 *
 * A promotion that is "active" but can never apply is a silent configuration
 * error:
 *  - `PROMO_CODE` without a code is never matched by `validatePromoCode`;
 *  - `CATEGORY_PERCENTAGE` without a category and `PRODUCT_*` without a
 *    product are skipped by the evaluator ("No target ... set");
 *  - `BOGO` / `MIX_AND_MATCH` need a product or category target (ARGUS #324).
 *
 * This module is the single pure source of those rules, shared by the Zod
 * request schema (form + API) and the service layer (server-side defence).
 * Promo-code uniqueness is case-insensitive; see `promoCodeConflicts`.
 */

export type PromotionTypeName =
  | 'CART_PERCENTAGE'
  | 'CART_FIXED'
  | 'CATEGORY_PERCENTAGE'
  | 'PRODUCT_PERCENTAGE'
  | 'PRODUCT_FIXED'
  | 'BOGO'
  | 'MIX_AND_MATCH'
  | 'PROMO_CODE';

export interface PromotionTypeFields {
  type?: string | null | undefined;
  promoCode?: string | null | undefined;
  targetCategoryId?: string | null | undefined;
  targetProductId?: string | null | undefined;
}

export interface PromotionFieldIssue {
  path: 'promoCode' | 'targetCategoryId' | 'targetProductId';
  message: string;
}

const PRODUCT_TARGET_TYPES = new Set(['PRODUCT_PERCENTAGE', 'PRODUCT_FIXED']);
const FREE_ITEM_TYPES = new Set(['BOGO', 'MIX_AND_MATCH']);

function present(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * Required target/code fields per type. Returns every missing requirement so
 * the form can show them at once; the route reports the first as the message.
 */
export function promotionTypeIssues(data: PromotionTypeFields): PromotionFieldIssue[] {
  const issues: PromotionFieldIssue[] = [];
  const type = data.type ?? undefined;

  if (type === 'PROMO_CODE' && !present(data.promoCode)) {
    issues.push({
      path: 'promoCode',
      message: 'Promo code is required for a promo code promotion',
    });
  }

  if (type === 'CATEGORY_PERCENTAGE' && !present(data.targetCategoryId)) {
    issues.push({
      path: 'targetCategoryId',
      message: 'Select a category for a category promotion',
    });
  }

  if (type && PRODUCT_TARGET_TYPES.has(type) && !present(data.targetProductId)) {
    issues.push({
      path: 'targetProductId',
      message: 'Select a product for a product promotion',
    });
  }

  if (
    type &&
    FREE_ITEM_TYPES.has(type) &&
    !present(data.targetProductId) &&
    !present(data.targetCategoryId)
  ) {
    issues.push({
      path: 'targetProductId',
      message: 'Select a target product or category for a free-item promotion',
    });
  }

  return issues;
}

/** Trim a promo code; blank means "no code" (null). */
export function normalizePromoCode(raw: string | null | undefined): string | null {
  if (raw === undefined || raw === null) return null;
  const trimmed = raw.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Identity key for case-insensitive uniqueness (`SUMMER10` = `summer10`).
 * Whitespace and surrounding case never create a second code.
 */
export function promoCodeKey(raw: string | null | undefined): string | null {
  const normalized = normalizePromoCode(raw);
  return normalized === null ? null : normalized.toLocaleUpperCase('en-US');
}

/** True when two non-empty promo codes collide case-insensitively. */
export function promoCodeConflicts(
  existing: string | null | undefined,
  candidate: string | null | undefined,
): boolean {
  const a = promoCodeKey(existing);
  const b = promoCodeKey(candidate);
  return a !== null && b !== null && a === b;
}
