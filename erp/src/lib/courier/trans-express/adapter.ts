import "server-only";

import { transExpressAuthenticate } from "@/lib/courier/trans-express/auth";
import { transExpressUploadSingle } from "@/lib/courier/trans-express/orders";
import { transExpressSyncLocations } from "@/lib/courier/trans-express/locations";
import { transExpressTrack } from "@/lib/courier/trans-express/tracking";
import type { CourierAdapter } from "@/lib/courier/types";
import type { CarrierProvider } from "@/generated/prisma/client";

/**
 * Concrete Trans Express adapter implementing the CourierAdapter interface.
 * Services talk to this adapter (never to the raw client) so additional carriers
 * can be added later without rework.
 */
export const transExpressAdapter: CourierAdapter = {
  provider: "TRANSEXPRESS" as CarrierProvider,
  authenticate: transExpressAuthenticate,
  uploadSingle: transExpressUploadSingle,
  track: transExpressTrack,
  syncLocations: transExpressSyncLocations,
};
