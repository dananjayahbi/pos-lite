/**
 * Shipping-configuration decision (ARGUS #292).
 *
 * `calculateShippingFee` used to return Rs 0.00 when the tenant had no active
 * rate card, making "not configured" indistinguishable from genuine free
 * shipping. This pure rule separates the two:
 *
 *   - no active card        -> not-configured, blocked
 *   - active card, fee = 0  -> free (an explicit config choice)
 *   - active card, fee > 0  -> charged
 */

export type ShippingChargeStatus = 'not-configured' | 'free' | 'charged';

export interface ShippingChargeDecision {
  status: ShippingChargeStatus;
  /** True only for a missing configuration; genuine free shipping is allowed. */
  blocked: boolean;
  message?: string;
}

export const SHIPPING_NOT_CONFIGURED_MESSAGE =
  'Shipping is not configured for this store. Set an active rate card before creating orders or deliveries.';

export function resolveShippingChargeDecision(input: {
  configured: boolean;
  shippingFee: number | string | null | undefined;
}): ShippingChargeDecision {
  if (!input.configured) {
    return {
      status: 'not-configured',
      blocked: true,
      message: SHIPPING_NOT_CONFIGURED_MESSAGE,
    };
  }

  const fee = Number(input.shippingFee ?? 0);
  if (!Number.isFinite(fee) || fee <= 0) {
    return { status: 'free', blocked: false };
  }
  return { status: 'charged', blocked: false };
}
