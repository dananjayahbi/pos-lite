import type { DeliveryStatus } from '@/generated/prisma/client';

/**
 * Courier/delivery status ordering — pure data with no `process.env`, no
 * Node builtins and no Prisma runtime, so it is safe to import from client
 * components.
 *
 * These live outside `constants/courier.ts` because that module is marked
 * `server-only` (it reads `TRANSEXPRESS_BASE_URL` from the environment). The
 * Orders / Dispatch queue needs the rank on the browser to validate bulk
 * status changes, and importing `courier.ts` there failed the production
 * build with:
 *
 *   'server-only' cannot be imported from a Client Component module.
 *
 * `courier.ts` re-exports everything below for server callers.
 */

/** Terminal delivery statuses. */
export const TERMINAL_DELIVERY_STATUSES: DeliveryStatus[] = [
  'DELIVERED',
  'CANCELED',
  'RETURNED',
];

/**
 * Forward progress order for courier-driven delivery statuses. Used so a late
 * or out-of-order carrier poll cannot move a dispatched parcel back to
 * "pending dispatch" (the first poll of a new shipment reports `submitted`).
 */
export const DELIVERY_STATUS_RANK: Record<DeliveryStatus, number> = {
  PLACED: 0,
  PENDING_DISPATCH: 1,
  HOLD: 1,
  PENDING_PICKUP: 2,
  DISPATCHED: 2,
  IN_TRANSIT: 3,
  OUT_FOR_DELIVERY: 4,
  DELIVERED: 5,
  FAILED: 5,
  RETURNED: 5,
  CANCELED: 5,
};

/** True when a carrier-mapped status should replace the delivery's status. */
export function isDeliveryStatusAdvance(
  current: DeliveryStatus,
  next: DeliveryStatus,
): boolean {
  if (current === next) return false;
  if (TERMINAL_DELIVERY_STATUSES.includes(current)) return false;
  if (next === 'FAILED' || next === 'RETURNED' || next === 'CANCELED') return true;
  return DELIVERY_STATUS_RANK[next] > DELIVERY_STATUS_RANK[current];
}
