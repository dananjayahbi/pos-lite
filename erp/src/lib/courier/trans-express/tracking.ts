import "server-only";

import { transExpressRequest } from "@/lib/courier/trans-express/client";
import { normalizeTracking } from "@/lib/courier/trans-express/mappers";
import type { CourierResult, CourierTracking } from "@/lib/courier/types";
import type { CourierEnv } from "@/generated/prisma/client";

/**
 * Fetch live tracking for a single waybill: POST /tracking { waybill_id }.
 * The raw response is normalized into the internal CourierTracking shape.
 */
export async function transExpressTrack(
  env: CourierEnv,
  token: string,
  waybillId: string,
): Promise<CourierResult<CourierTracking>> {
  const result = await transExpressRequest<unknown>(env, "/tracking", {
    method: "POST",
    token,
    body: { waybill_id: waybillId },
    timeoutMs: 10_000,
  });

  if (!result.ok) return result;

  return { ok: true, data: normalizeTracking(result.data) };
}
