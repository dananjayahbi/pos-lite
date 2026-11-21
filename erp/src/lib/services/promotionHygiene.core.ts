/**
 * Promotion data hygiene (ARGUS #68).
 *
 * Promotions with no start/end date apply indefinitely, and BOGO/Mix promotions
 * without a target can never apply (the evaluator skips them). Both are easy to
 * miss on the list, so the UI and a read-only audit script share this summary.
 */

export interface PromotionHygieneRow {
  id: string;
  name: string;
  type: string;
  isActive: boolean;
  startsAt: Date | string | null;
  endsAt: Date | string | null;
  targetCategoryId: string | null;
  targetProductId: string | null;
}

export interface PromotionHygiene {
  /** Active promotions with no date window - they apply forever. */
  openEnded: PromotionHygieneRow[];
  /** BOGO/Mix promotions with no product/category target - dead rows. */
  missingTarget: PromotionHygieneRow[];
  /** Active promotions expiring within the next 7 days (if they have endsAt). */
  expiringSoon: PromotionHygieneRow[];
}

const TARGETED_TYPES = new Set(['BOGO', 'MIX_AND_MATCH']);

export function auditPromotions(
  rows: PromotionHygieneRow[],
  now: Date = new Date(),
): PromotionHygiene {
  const openEnded: PromotionHygieneRow[] = [];
  const missingTarget: PromotionHygieneRow[] = [];
  const expiringSoon: PromotionHygieneRow[] = [];
  const soon = now.getTime() + 7 * 24 * 60 * 60 * 1000;

  for (const row of rows) {
    if (!row.isActive) continue;

    if (!row.startsAt && !row.endsAt) openEnded.push(row);

    if (
      TARGETED_TYPES.has(row.type) &&
      !row.targetCategoryId &&
      !row.targetProductId
    ) {
      missingTarget.push(row);
    }

    if (row.endsAt) {
      const ends = new Date(row.endsAt).getTime();
      if (Number.isFinite(ends) && ends >= now.getTime() && ends <= soon) {
        expiringSoon.push(row);
      }
    }
  }

  return { openEnded, missingTarget, expiringSoon };
}
