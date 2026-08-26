import "server-only";

import { transExpressAuthenticate } from "@/lib/courier/trans-express/auth";
import { transExpressUploadSingle } from "@/lib/courier/trans-express/orders";
import { transExpressSyncLocations } from "@/lib/courier/trans-express/locations";
import { transExpressTrack } from "@/lib/courier/trans-express/tracking";
import { TRANSEXPRESS_STATUS_MAP } from "@/lib/constants/courier";
import type {
  CourierAdapter,
  CourierStatusMapping,
} from "@/lib/courier/types";
import type {
  CarrierProvider,
  DeliveryStatus,
  ShipmentStatus,
} from "@/generated/prisma/client";

/**
 * Map a raw Trans Express status string to normalized Shipment / Delivery
 * statuses. Unknown statuses default to PROCESSING / IN_TRANSIT.
 */
export function transExpressMapStatus(raw: string | undefined): CourierStatusMapping {
  if (!raw) return { shipment: "PROCESSING", delivery: "IN_TRANSIT" };
  const normalized = raw.trim().toLowerCase();
  return (
    TRANSEXPRESS_STATUS_MAP[normalized] ?? {
      shipment: "PROCESSING" as ShipmentStatus,
      delivery: "IN_TRANSIT" as DeliveryStatus,
    }
  );
}

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
  mapStatus: transExpressMapStatus,
};
