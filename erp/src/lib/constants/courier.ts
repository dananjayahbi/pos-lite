import "server-only";

import type {
  CourierEnv,
  DeliveryStatus,
  ShipmentStatus,
} from "@/generated/prisma/client";

/**
 * Trans Express API configuration.
 * Base URLs are resolved from the per-tenant CourierAccount.env as authoritative,
 * with these values as defaults / platform-level overrides.
 */
export const TRANSEXPRESS_BASE_URLS: Record<CourierEnv, string> = {
  STAGING: process.env.TRANSEXPRESS_BASE_URL_STAGING ?? "https://dev-transexpress.parallaxtec.com/api",
  PRODUCTION: process.env.TRANSEXPRESS_BASE_URL_PROD ?? "https://portal.transexpress.lk/api",
};

/** Request timeouts (ms) per operation type. */
export const TRANSEXPRESS_TIMEOUTS = {
  login: 15_000,
  upload: 15_000,
  tracking: 10_000,
  locations: 15_000,
} as const;

/** Retry policy for transient failures (network / 5xx / rate-limit). */
export const TRANSEXPRESS_RETRY = {
  maxAttempts: 3,
  backoffMs: [1_000, 3_000, 9_000],
} as const;

/**
 * Trans Express status string → normalized ShipmentStatus + derived DeliveryStatus.
 * Unknown statuses default to PROCESSING / IN_TRANSIT rather than erroring.
 */
export const TRANSEXPRESS_STATUS_MAP: Record<
  string,
  { shipment: ShipmentStatus; delivery: DeliveryStatus }
> = {
  submitted: { shipment: "SUBMITTED", delivery: "PENDING_DISPATCH" },
  placed: { shipment: "SUBMITTED", delivery: "PENDING_DISPATCH" },
  processing: { shipment: "PROCESSING", delivery: "IN_TRANSIT" },
  pendingpickup: { shipment: "PROCESSING", delivery: "PENDING_PICKUP" },
  pickup: { shipment: "PROCESSING", delivery: "PENDING_PICKUP" },
  intransit: { shipment: "IN_TRANSIT", delivery: "IN_TRANSIT" },
  transit: { shipment: "IN_TRANSIT", delivery: "IN_TRANSIT" },
  pickedup: { shipment: "PICKED_UP", delivery: "IN_TRANSIT" },
  outfordelivery: { shipment: "OUT_FOR_DELIVERY", delivery: "OUT_FOR_DELIVERY" },
  delivered: { shipment: "DELIVERED", delivery: "DELIVERED" },
  failed: { shipment: "FAILED", delivery: "FAILED" },
  deliveryfailed: { shipment: "FAILED", delivery: "FAILED" },
  cancelled: { shipment: "CANCELED", delivery: "CANCELED" },
  canceled: { shipment: "CANCELED", delivery: "CANCELED" },
  returned: { shipment: "RETURNED", delivery: "RETURNED" },
  returnedtobranch: { shipment: "RETURNED", delivery: "RETURNED" },
};

/** Terminal shipment statuses — poller skips these. */
export const TERMINAL_SHIPMENT_STATUSES: ShipmentStatus[] = [
  "DELIVERED",
  "CANCELED",
  "RETURNED",
  // A failed attempt is final for this shipment; recovery creates a new one.
  "FAILED",
];

/** Terminal delivery statuses. */
export const TERMINAL_DELIVERY_STATUSES: DeliveryStatus[] = [
  "DELIVERED",
  "CANCELED",
  "RETURNED",
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
  if (next === "FAILED" || next === "RETURNED" || next === "CANCELED") return true;
  return DELIVERY_STATUS_RANK[next] > DELIVERY_STATUS_RANK[current];
}

/** Hold-buffer window before auto-dispatch/expiry (ms). */
export const HOLD_BUFFER_DURATION_MS = 45 * 60 * 1000; // 45 minutes

/** Default rate card values. */
export const DEFAULT_FREE_BASE_WEIGHT_KG = 1;

/** Polling throttle: minimum gap between checks for the same shipment (ms). */
export const MIN_TRACKING_INTERVAL_MS = 2 * 60 * 60 * 1000; // 2 hours

/** Max shipments to poll per cron run per tenant. */
export const TRACKING_BATCH_SIZE = 50;

export function resolveBaseUrl(env: CourierEnv): string {
  return TRANSEXPRESS_BASE_URLS[env];
}
