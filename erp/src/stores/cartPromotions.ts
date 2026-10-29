import type { AppliedDiscount, SkippedPromotion } from '@/lib/services/promotion.service';

/**
 * The promotion state that belongs to a specific set of cart lines.
 *
 * Cart restores (undo, held-sale retrieve, IndexedDB reload) put the lines back
 * without re-pricing them, so the promotion state has to travel with the lines.
 * Without this the cart comes back at full price with an empty Promotions row.
 */
export interface CartPromotionSnapshot {
  appliedPromotions: AppliedDiscount[];
  skippedPromotions: SkippedPromotion[];
  totalPromotionDiscount: string;
  appliedPromoCode: string | null;
}

export const EMPTY_CART_PROMOTIONS: CartPromotionSnapshot = {
  appliedPromotions: [],
  skippedPromotions: [],
  totalPromotionDiscount: '0',
  appliedPromoCode: null,
};

export function createCartPromotionSnapshot(
  source: Partial<CartPromotionSnapshot> | null | undefined,
): CartPromotionSnapshot {
  if (!source) return { ...EMPTY_CART_PROMOTIONS };
  return {
    appliedPromotions: source.appliedPromotions ?? [],
    skippedPromotions: source.skippedPromotions ?? [],
    totalPromotionDiscount: source.totalPromotionDiscount ?? '0',
    appliedPromoCode: source.appliedPromoCode ?? null,
  };
}
