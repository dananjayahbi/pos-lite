/**
 * Promotion usage from the sale ledger (ARGUS #331).
 *
 * `Sale.appliedPromotions` stores the server-evaluated `AppliedDiscount[]` for
 * each completed sale (JSON, existing column). That is the only durable record
 * of a promotion actually being used, so the promotions list derives a
 * per-promotion count from it instead of adding a schema counter.
 *
 * Read-only: this never mutates a sale or a promotion.
 */

export interface SalePromotionUsageSource {
  appliedPromotions: unknown;
}

export interface PromotionUsageSummary {
  /** promotionId -> number of non-voided sales that applied it. */
  countByPromotionId: Record<string, number>;
  /** promotionId -> discount money applied across those sales (LKR string). */
  discountByPromotionId: Record<string, string>;
  salesWithPromotions: number;
}

function asRecord(entry: unknown): Record<string, unknown> | null {
  return typeof entry === 'object' && entry !== null
    ? (entry as Record<string, unknown>)
    : null;
}

/**
 * Summarize the promotion records on the given sales.
 *
 * Only entries with a non-empty string `promotionId` count. A malformed JSON
 * payload is ignored rather than crashing the list; `CUSTOMER_PRICING` and
 * other synthetic records that carry an id still count, which is intentional:
 * the id is what the list joins on.
 */
export function summarizePromotionUsage(
  sales: readonly SalePromotionUsageSource[],
): PromotionUsageSummary {
  const countByPromotionId: Record<string, number> = {};
  const discountByPromotionId: Record<string, number> = {};
  let salesWithPromotions = 0;

  for (const sale of sales) {
    if (!Array.isArray(sale.appliedPromotions)) continue;
    let counted = false;

    for (const raw of sale.appliedPromotions) {
      const entry = asRecord(raw);
      if (!entry) continue;
      const promotionId = entry.promotionId;
      if (typeof promotionId !== 'string' || promotionId.trim() === '') continue;

      countByPromotionId[promotionId] = (countByPromotionId[promotionId] ?? 0) + 1;
      const amount = Number(entry.discountAmount);
      if (Number.isFinite(amount) && amount > 0) {
        discountByPromotionId[promotionId] =
          (discountByPromotionId[promotionId] ?? 0) + amount;
      }
      counted = true;
    }

    if (counted) salesWithPromotions += 1;
  }

  const discountTotals: Record<string, string> = {};
  for (const [id, total] of Object.entries(discountByPromotionId)) {
    discountTotals[id] = total.toFixed(2);
  }

  return { countByPromotionId, discountByPromotionId: discountTotals, salesWithPromotions };
}
