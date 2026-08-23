import type { DeliveryStatus } from '@/generated/prisma/client';

/**
 * Customer-facing delivery status mapping.
 *
 * Translates internal/operational `DeliveryStatus` values into friendly,
 * provider-agnostic wording and a linear timeline stage index. Kept in a
 * small, dependency-free module so it can be unit-tested without a DB.
 */

export interface CustomerStatusStage {
  /** Stable key for the timeline (never a raw enum). */
  key: string;
  /** Friendly label shown to the customer. */
  label: string;
  /** 0-based stage index used to highlight the current stage. */
  stage: number;
}

export interface DeliveryStatusMapping {
  /** Overall customer-friendly summary label. */
  label: string;
  /** Whether the state is terminal (no further movement expected). */
  isTerminal: boolean;
  /** Whether this is a failure/return that should be shown clearly. */
  isFailure: boolean;
  /** Timeline stage info. */
  stage: CustomerStatusStage;
}

const STAGE_ORDER = [
  'order-confirmed',
  'preparing',
  'shipped',
  'in-transit',
  'out-for-delivery',
  'delivered',
] as const;

const TERMINAL = new Set<DeliveryStatus>(['DELIVERED', 'FAILED', 'CANCELED', 'RETURNED']);

const MAPPINGS: Record<DeliveryStatus, Omit<DeliveryStatusMapping, 'isTerminal'>> = {
  PLACED: { label: 'Order confirmed', isFailure: false, stage: { key: 'order-confirmed', label: 'Order confirmed', stage: 0 } },
  PENDING_DISPATCH: { label: 'Preparing your order', isFailure: false, stage: { key: 'preparing', label: 'Preparing', stage: 1 } },
  HOLD: { label: 'Order on hold', isFailure: false, stage: { key: 'preparing', label: 'On hold', stage: 1 } },
  DISPATCHED: { label: 'Shipped', isFailure: false, stage: { key: 'shipped', label: 'Shipped', stage: 2 } },
  IN_TRANSIT: { label: 'In transit', isFailure: false, stage: { key: 'in-transit', label: 'In transit', stage: 3 } },
  OUT_FOR_DELIVERY: { label: 'Out for delivery', isFailure: false, stage: { key: 'out-for-delivery', label: 'Out for delivery', stage: 4 } },
  DELIVERED: { label: 'Delivered', isFailure: false, stage: { key: 'delivered', label: 'Delivered', stage: 5 } },
  FAILED: { label: 'Delivery failed', isFailure: true, stage: { key: 'in-transit', label: 'In transit', stage: 3 } },
  CANCELED: { label: 'Order cancelled', isFailure: true, stage: { key: 'order-confirmed', label: 'Order confirmed', stage: 0 } },
  RETURNED: { label: 'Returned', isFailure: true, stage: { key: 'shipped', label: 'Shipped', stage: 2 } },
  PENDING_PICKUP: { label: 'Ready for pickup', isFailure: false, stage: { key: 'out-for-delivery', label: 'Ready for pickup', stage: 4 } },
};

/**
 * Map a raw internal DeliveryStatus to customer-facing wording.
 * Unknown values fall back to a neutral "In progress" state.
 */
export function mapCustomerDeliveryStatus(
  status: DeliveryStatus | string | null | undefined,
): DeliveryStatusMapping {
  if (status && status in MAPPINGS) {
    const m = MAPPINGS[status as DeliveryStatus];
    return { ...m, isTerminal: TERMINAL.has(status as DeliveryStatus) };
  }
  return {
    label: 'Order in progress',
    isFailure: false,
    isTerminal: false,
    stage: { key: 'order-confirmed', label: 'Order confirmed', stage: 0 },
  };
}

/** Ordered timeline stage keys (for rendering all milestones). */
export const TIMELINE_STAGES: readonly string[] = STAGE_ORDER;
