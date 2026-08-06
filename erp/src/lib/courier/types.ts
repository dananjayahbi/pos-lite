import "server-only";

import type { CarrierProvider, CourierEnv, WaybillMode } from "@/generated/prisma/client";

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
export interface CourierAdapter {
  readonly provider: CarrierProvider;

  /** Log in (or validate a stored token/API key) and return an auth token. */
  authenticate(account: {
    email?: string | undefined;
    password?: string | undefined;
    apiKey?: string | undefined;
    env: CourierEnv;
  }): Promise<CourierResult<string>>;

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
}
