/**
 * ARGUS #272 - one cancel rule for the delivery list and detail.
 *
 * Both surfaces must offer the same confirmed flow with a reason field. The
 * service enforces the same pre-dispatch statuses, so the UI helper mirrors it
 * rather than keeping two narrower lists.
 */
import type { DeliveryStatus } from '@/generated/prisma/client';

export const CANCELLABLE_DELIVERY_STATUSES: readonly DeliveryStatus[] = [
  'PLACED',
  'PENDING_DISPATCH',
  'HOLD',
];

export function canCancelDelivery(status: DeliveryStatus | string | null | undefined): boolean {
  if (!status) return false;
  return (CANCELLABLE_DELIVERY_STATUSES as readonly string[]).includes(status);
}

/** Human-readable list used in the confirmation dialog copy. */
export function cancellableStatusesLabel(): string {
  return CANCELLABLE_DELIVERY_STATUSES.join(', ');
}
