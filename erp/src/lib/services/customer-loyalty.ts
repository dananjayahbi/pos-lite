// ── Loyalty tier derivation (docs 19 / 20 / 21) ─────────────────────────────
// Shared, pure helpers used by both list and detail paths so the tier logic
// stays identical everywhere. No DB access here.

export type LoyaltyTier = 'FIRST_TIME' | 'REPEAT' | 'LOYAL';

/** Minimum order count to be considered a repeat buyer (doc 20). */
export const REPEAT_ORDER_THRESHOLD = 2;
/** Order count at which a customer is upgraded to the "Loyal" tier. */
export const LOYAL_ORDER_THRESHOLD = 5;

export interface LoyaltyTierMeta {
  label: string;
  /** Short human hint shown as a tooltip, e.g. "2+ orders". */
  hint: string;
}

export const LOYALTY_TIER_META: Record<LoyaltyTier, LoyaltyTierMeta> = {
  FIRST_TIME: { label: 'New', hint: 'Fewer than 2 orders' },
  REPEAT: { label: 'Repeat', hint: '2+ orders' },
  LOYAL: { label: 'Loyal', hint: '5+ orders' },
};

/**
 * Map an order count to a loyalty tier.
 * - first-time = 0–1 orders
 * - repeat     = ≥2 orders
 * - loyal      = ≥5 orders
 */
export function getLoyaltyTier(orderCount: number): LoyaltyTier {
  if (orderCount >= LOYAL_ORDER_THRESHOLD) return 'LOYAL';
  if (orderCount >= REPEAT_ORDER_THRESHOLD) return 'REPEAT';
  return 'FIRST_TIME';
}

// ── Repeat-buyer metals (Level 3 badge) ──────────────────────────────────────
// Distinct from the New/Repeat/Loyal tier above: the metal badge is the
// reward-style label the owner asked for on Customer Analytics.
export type RepeatBadgeTier = 'GOLD' | 'SILVER' | 'BRONZE';

export const REPEAT_BADGE_META: Record<
  RepeatBadgeTier,
  { label: string; hint: string }
> = {
  GOLD: { label: 'Gold', hint: '10+ orders' },
  SILVER: { label: 'Silver', hint: '5–9 orders' },
  BRONZE: { label: 'Bronze', hint: '2–4 orders' },
};

/**
 * Map a customer's lifetime order count to a repeat-buyer metal.
 * Returns `null` for first-time buyers (<2 orders), who get no badge.
 */
export function getRepeatBadge(orderCount: number): RepeatBadgeTier | null {
  if (orderCount >= 10) return 'GOLD';
  if (orderCount >= 5) return 'SILVER';
  if (orderCount >= REPEAT_ORDER_THRESHOLD) return 'BRONZE';
  return null;
}
