import type { DeliveryStatus } from '@/generated/prisma/client';
import { DELIVERY_STATUS_RANK } from '@/lib/constants/courier';

/**
 * ARGUS #263 — legal bulk status targets for the Orders / Dispatch queue.
 *
 * Carrier/recovery states must not be forged from a dropdown:
 *  - DELIVERED requires an already-dispatched parcel (a courier shipment).
 *  - FAILED / RETURNED are driven by tracking or the recovery desk, which also
 *    owns restock, packaging reversal and COD clearing. The bulk action
 *    rejects them and points at Failed Deliveries & Recovery.
 *  - CANCELED is only offered pre-dispatch; the route routes it through the
 *    normal cancel service (stock + COD effects).
 */

export const PRE_DISPATCH_STATUSES: readonly DeliveryStatus[] = [
  'PLACED',
  'PENDING_DISPATCH',
  'HOLD',
];

export const DISPATCHED_STATUSES: readonly DeliveryStatus[] = [
  'DISPATCHED',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'PENDING_PICKUP',
];

export const TERMINAL_DELIVERY_STATUSES: readonly DeliveryStatus[] = [
  'DELIVERED',
  'CANCELED',
  'RETURNED',
];

export const RECOVERY_ONLY_TARGETS: readonly DeliveryStatus[] = [
  'FAILED',
  'RETURNED',
];

const CARRIER_TARGETS: readonly DeliveryStatus[] = [
  'DISPATCHED',
  'IN_TRANSIT',
  'OUT_FOR_DELIVERY',
  'PENDING_PICKUP',
  'DELIVERED',
];

/** Statuses the bulk dialog may offer for one order in its current state. */
export function bulkStatusTargetsForOrder(
  current: DeliveryStatus,
  hasShipment: boolean,
): DeliveryStatus[] {
  if (current === 'FAILED' || TERMINAL_DELIVERY_STATUSES.includes(current)) {
    return [];
  }

  const targets: DeliveryStatus[] = [];

  if (current === 'PLACED' || current === 'HOLD') targets.push('PENDING_DISPATCH');
  if (current === 'PLACED' || current === 'PENDING_DISPATCH') targets.push('HOLD');
  if (PRE_DISPATCH_STATUSES.includes(current)) targets.push('CANCELED');

  if (DISPATCHED_STATUSES.includes(current) && hasShipment) {
    for (const target of CARRIER_TARGETS) {
      if (DELIVERY_STATUS_RANK[target] > DELIVERY_STATUS_RANK[current]) {
        targets.push(target);
      }
    }
  }

  return targets;
}

/**
 * Why this bulk transition is not allowed, or `null` when it is. Shared by the
 * dialog (to hide dead options) and the API (to reject a forged payload).
 */
export function bulkStatusRejection(
  current: DeliveryStatus,
  target: DeliveryStatus,
  hasShipment: boolean,
): string | null {
  if (current === target) return 'Already in this status';
  if (current === 'FAILED' || TERMINAL_DELIVERY_STATUSES.includes(current)) {
    return 'Delivery is already in a final state';
  }
  if (target === 'FAILED' || target === 'RETURNED') {
    return 'Use Failed Deliveries & Recovery to mark a parcel failed or returned';
  }

  if (bulkStatusTargetsForOrder(current, hasShipment).includes(target)) {
    return null;
  }

  if (CARRIER_TARGETS.includes(target)) {
    return hasShipment ? 'Invalid status transition' : 'Dispatch the delivery first';
  }
  if (target === 'CANCELED') {
    return 'Use Failed Deliveries & Recovery to cancel a dispatched parcel';
  }
  return 'Invalid status transition';
}

/** Statuses every selected order can move to (dialog intersection). */
export function commonBulkStatusTargets(
  orders: ReadonlyArray<{ status: DeliveryStatus; hasShipment: boolean }>,
): DeliveryStatus[] {
  if (orders.length === 0) return [];

  const [first, ...rest] = orders.map((order) =>
    bulkStatusTargetsForOrder(order.status, order.hasShipment),
  );
  return first!.filter((target) => rest.every((targets) => targets.includes(target)));
}
