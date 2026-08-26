import "server-only";

import Decimal from "decimal.js";
import { formatPhoneNumber } from "@/lib/whatsapp";
import { toCourierOrderPayload } from "@/lib/courier/mappers";
import type { CourierOrderPayload, CourierTracking, CourierTrackingEvent } from "@/lib/courier/types";

/**
 * @deprecated Use the provider-agnostic `toCourierOrderPayload` from
 * `@/lib/courier/mappers` instead. The payload shape is identical; this alias
 * is kept so existing callers keep working during the migration.
 */
export const toTransExpressPayload = toCourierOrderPayload;

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
