/**
 * ARGUS #275 - PLACED and HOLD deliveries can be advanced into the dispatch
 * queue without leaving Deliveries & Tracking for the separate Dispatch
 * Orders page.
 *
 * The bulk prepare service already accepts PLACED/HOLD and rejects anything
 * already prepared or dispatched, so this helper mirrors that state rule.
 */
import type { DeliveryStatus } from '@/generated/prisma/client';

export const PREPARABLE_DELIVERY_STATUSES: readonly DeliveryStatus[] = [
  'PLACED',
  'HOLD',
];

export function canPrepareDelivery(status: DeliveryStatus | string | null | undefined): boolean {
  if (!status) return false;
  return (PREPARABLE_DELIVERY_STATUSES as readonly string[]).includes(status);
}
