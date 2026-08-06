import "server-only";

import Decimal from "decimal.js";
import { formatPhoneNumber } from "@/lib/whatsapp";
import type { CourierOrderPayload, CourierTracking, CourierTrackingEvent } from "@/lib/courier/types";

/**
 * Map an internal delivery's ShippingAddress + Delivery fields to a Trans Express
 * single-order payload. Single-order endpoints use: waybill_id / order_no /
 * customer_name / address / description / phone_no / phone_no2 / cod / city_id
 * (or `city` text for without-city variants) / note.
 */

interface MapperAddress {
  fullName: string;
  phone: string;
  phone2?: string | null | undefined;
  addressLine1: string;
  addressLine2?: string | null | undefined;
  cityId?: number | null | undefined;
  cityName?: string | null | undefined;
  districtId?: number | null | undefined;
}

interface MapperDelivery {
  orderRef: string;
  codAmount: { toString(): string };
  notes?: string | null | undefined;
  itemCount?: number | undefined;
}

/** Normalize an E.164/leading-0 phone for the courier payload. */
function normalizePhone(phone: string): string {
  try {
    return formatPhoneNumber(phone);
  } catch {
    return phone.replace(/[\s\-()]/g, "");
  }
}

/** Build the base (with-city) single-order payload. */
export function toTransExpressPayload(
  address: MapperAddress,
  delivery: MapperDelivery,
  opts: { waybillId?: string | undefined; description?: string | undefined } = {},
): CourierOrderPayload {
  const street = address.addressLine2
    ? `${address.addressLine1}, ${address.addressLine2}`
    : address.addressLine1;

  return {
    orderNo: delivery.orderRef,
    customerName: address.fullName,
    address: street,
    phone: normalizePhone(address.phone),
    phone2: address.phone2 ? normalizePhone(address.phone2) : undefined,
    cod: Number(new Decimal(delivery.codAmount.toString()).toFixed(2)),
    cityId: address.cityId ?? undefined,
    cityText: address.cityId ? undefined : (address.cityName ?? undefined),
    districtId: address.districtId ?? undefined,
    description: opts.description ?? (delivery.itemCount ? `${delivery.itemCount} parcel(s)` : undefined),
    note: delivery.notes ?? undefined,
    waybillId: opts.waybillId,
  };
}

/** Normalize the raw tracking response body into the internal CourierTracking shape. */
export function normalizeTracking(raw: unknown): CourierTracking {
  const body = (raw ?? {}) as Record<string, unknown>;
  const data = (body.data ?? body) as Record<string, unknown>;

  const history = Array.isArray(data.status_history)
    ? (data.status_history as Record<string, unknown>[]).map(
        (h): CourierTrackingEvent => ({
          name: typeof h.name === "string" ? h.name : "",
          remarks: typeof h.remarks === "string" ? h.remarks : undefined,
          addedDate: typeof h.added_date === "string" ? h.added_date : undefined,
        }),
      )
    : [];

  return {
    waybillId: String(data.waybill_id ?? ""),
    orderNo: typeof data.order_no === "string" ? data.order_no : undefined,
    customerName: typeof data.customer_name === "string" ? data.customer_name : undefined,
    address: typeof data.customer_address === "string" ? data.customer_address : undefined,
    district: typeof data.customer_district === "string" ? data.customer_district : undefined,
    city: typeof data.customer_city === "string" ? data.customer_city : undefined,
    phone: typeof data.customer_phone_no === "string" ? data.customer_phone_no : undefined,
    weightKg: typeof data.weight === "number" ? data.weight : undefined,
    placedDate: typeof data.placed_date === "string" ? data.placed_date : undefined,
    completedDate: typeof data.completed_date === "string" ? data.completed_date : undefined,
    currentStatus: typeof data.current_status === "string" ? data.current_status : undefined,
    statusHistory: history,
    raw,
  };
}
