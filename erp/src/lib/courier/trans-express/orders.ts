import "server-only";

import { transExpressRequest } from "@/lib/courier/trans-express/client";
import type { CourierOrderPayload, CourierResult, CourierUploadedOrder } from "@/lib/courier/types";
import type { CourierEnv, WaybillMode } from "@/generated/prisma/client";

/**
 * Single-order upload to Trans Express.
 * Picks the endpoint variant based on waybill mode (manual/auto) and whether a
 * numeric city_id is available (with-city vs without-city).
 *
 * Endpoint matrix (single):
 *  - AUTO + city_id   → /orders/upload/single-auto
 *  - MANUAL + city_id → /orders/upload/single-manual
 *  - AUTO + city text → /orders/upload/single-auto-without-city
 *  - MANUAL + city text → /orders/upload/single-manual-without-city
 */

interface UploadPayload {
  waybill_id?: string;
  order_no?: string;
  customer_name?: string;
  address?: string;
  description?: string;
  phone_no?: string;
  phone_no2?: string;
  cod?: number;
  city_id?: number;
  city?: string;
  district_id?: number;
  note?: string;
}

interface UploadResponse {
  success?: boolean;
  order?: {
    waybill_id?: string;
    id?: string;
    order_no?: string;
    status_id?: number;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

function resolveEndpoint(waybillMode: WaybillMode, hasCityId: boolean): string {
  const auto = waybillMode === "AUTO";
  if (hasCityId) {
    return auto ? "/orders/upload/single-auto" : "/orders/upload/single-manual";
  }
  return auto ? "/orders/upload/single-auto-without-city" : "/orders/upload/single-manual-without-city";
}

function toEndpointPayload(payload: CourierOrderPayload): UploadPayload {
  const result: UploadPayload = {
    order_no: payload.orderNo,
    customer_name: payload.customerName,
    address: payload.address,
    phone_no: payload.phone,
    cod: payload.cod,
  };
  if (payload.phone2) result.phone_no2 = payload.phone2;
  if (payload.description) result.description = payload.description;
  if (payload.note) result.note = payload.note;
  if (payload.waybillId) result.waybill_id = payload.waybillId;
  if (payload.cityId) {
    result.city_id = payload.cityId;
  } else if (payload.cityText) {
    result.city = payload.cityText;
  }
  if (payload.districtId) result.district_id = payload.districtId;
  return result;
}

export async function transExpressUploadSingle(
  env: CourierEnv,
  token: string,
  upload: { waybillMode: WaybillMode; payload: CourierOrderPayload },
): Promise<CourierResult<CourierUploadedOrder>> {
  const { waybillMode, payload } = upload;
  const endpoint = resolveEndpoint(waybillMode, Boolean(payload.cityId));
  const body = toEndpointPayload(payload);

  const result = await transExpressRequest<UploadResponse>(env, endpoint, {
    method: "POST",
    token,
    body,
    timeoutMs: 15_000,
  });

  if (!result.ok) return result;

  const order = result.data?.order;
  const waybillId = order?.waybill_id ?? payload.waybillId;
  if (!waybillId) {
    return {
      ok: false,
      error: {
        category: "VALIDATION",
        message: "Trans Express upload returned no waybill id",
        details: result.data,
      },
    };
  }

  return {
    ok: true,
    data: { waybillId, courierOrderId: order?.id, raw: result.data },
  };
}

