import "server-only";

import type {
  CarrierProvider,
  CourierEnv,
  DeliveryStatus,
  ShipmentStatus,
  WaybillMode,
} from "@/generated/prisma/client";

/**
 * Courier adapter shared types.
 * The ERP talks to a transport-adapter interface (never directly to a carrier)
 * so additional carriers can be added without rework.
 */

export type CourierErrorCategory =
  | "AUTH"
  | "VALIDATION"
  | "RATE_LIMIT"
  | "NETWORK"
  | "UNKNOWN";

/** Typed adapter result — never throw for expected API failures. */
export type CourierResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: { category: CourierErrorCategory; message: string; details?: unknown } };

/** Normalized location entries from Trans Express master data. */
export interface CourierLocation {
  id: number;
  text: string;
}

export interface CourierProvince {
  id: number;
  text: string;
}

export type CourierDistrict = CourierLocation;

export type CourierCity = CourierLocation;

/** Parcel payload for a single-order upload. */
export interface CourierOrderPayload {
  orderNo: string;
  customerName: string;
  address: string;
  phone: string;
  phone2?: string | undefined;
  cod: number;
  cityId?: number | undefined;
  cityText?: string | undefined;
  districtId?: number | undefined;
  description?: string | undefined;
  note?: string | undefined;
  waybillId?: string | undefined; // only for manual waybill mode
}

/** A single-order upload (waybill mode + payload), delivery-linked for audit. */
export interface CourierOrderUpload {
  deliveryId: string;
  waybillMode: WaybillMode;
  payload: CourierOrderPayload;
}

/** Successful single-order upload response (normalized). */
export interface CourierUploadedOrder {
  waybillId: string;
  courierOrderId?: string | undefined;
  raw: unknown;
}

/** Normalized status-history event from tracking. */
export interface CourierTrackingEvent {
  name: string;
  remarks?: string | undefined;
  addedDate?: string | undefined;
}

/** Normalized tracking result. */
export interface CourierTracking {
  waybillId: string;
  orderNo?: string | undefined;
  customerName?: string | undefined;
  address?: string | undefined;
  district?: string | undefined;
  city?: string | undefined;
  phone?: string | undefined;
  weightKg?: number | undefined;
  placedDate?: string | undefined;
  completedDate?: string | undefined;
  currentStatus?: string | undefined;
  statusHistory: CourierTrackingEvent[];
  raw: unknown;
}

/**
 * The transport-adapter contract. A concrete adapter (e.g. TransExpressAdapter)
 * implements this so dispatch/tracking services stay carrier-agnostic.
 */
/** The credential fields a provider needs to authenticate. */
export interface CourierAuthCredentials {
  email?: string | undefined;
  password?: string | undefined;
  apiKey?: string | undefined;
}

/** Normalized status result produced by each provider's own status mapping. */
export interface CourierStatusMapping {
  shipment: ShipmentStatus;
  delivery: DeliveryStatus;
}

/**
 * The transport-adapter contract. A concrete adapter (e.g. TransExpressAdapter)
 * implements this so dispatch/tracking services stay carrier-agnostic.
 *
 * Every provider must implement every operation so services can resolve a
 * provider from the registry and call the same methods regardless of carrier.
 */
export interface CourierAdapter {
  readonly provider: CarrierProvider;

  /** Log in (or validate a stored token/API key) and return an auth token. */
  authenticate(account: CourierAuthCredentials & { env: CourierEnv }): Promise<CourierResult<string>>;

  /** Upload a single order; returns the issued waybill. */
  uploadSingle(
    env: CourierEnv,
    token: string,
    upload: { waybillMode: WaybillMode; payload: CourierOrderPayload },
  ): Promise<CourierResult<CourierUploadedOrder>>;

  /** Fetch live tracking for a waybill. */
  track(
    env: CourierEnv,
    token: string,
    waybillId: string,
  ): Promise<CourierResult<CourierTracking>>;

  /** Pull master location data (provinces → districts → cities). */
  syncLocations(env: CourierEnv, token: string): Promise<CourierResult<{
    provinces: CourierProvince[];
    districts: CourierDistrict[];
    cities: CourierCity[];
  }>>;

  /**
   * Map a provider's raw status string to the internal normalized Shipment /
   * Delivery statuses. Kept on the adapter so each provider owns its own status
   * vocabulary — the tracking pipeline stays provider-agnostic.
   */
  mapStatus(raw: string | undefined): CourierStatusMapping;
}

/**
 * Static metadata for a courier provider — used by the config seam to describe
 * what credentials / endpoints / hooks a provider needs without hardcoding the
 * adapter resolution. Providers that are not yet integrated carry
 * `implemented: false` and empty endpoint maps.
 */
export interface CourierProviderConfig {
  provider: CarrierProvider;
  /** Human-readable label (e.g. "Trans Express"). */
  label: string;
  /** Whether a concrete adapter is registered in the registry. */
  implemented: boolean;
  /** Credential fields the provider accepts for authentication. */
  authFields: Array<keyof CourierAuthCredentials>;
  /** Per-environment API base URLs (empty when not implemented). */
  baseUrls: Partial<Record<CourierEnv, string>>;
  /** Callback / notification hooks the provider may call (webhooks). */
  hooks?: {
    /** Base path for receiving shipment status webhooks from the carrier. */
    statusWebhook?: string | undefined;
    /** Base path for receiving delivery confirmation / failure callbacks. */
    confirmationWebhook?: string | undefined;
  };
}
