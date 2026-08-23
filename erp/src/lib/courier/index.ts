import "server-only";

/**
 * Courier module — the single entry point for courier code.
 *
 * Consumers should import adapters / helpers from here (or from `registry.ts`)
 * rather than reaching into `trans-express/` directly, so additional carriers
 * can be introduced by registering an adapter without touching consumers.
 */

// Types + contract
export type {
  CourierAdapter,
  CourierAuthCredentials,
  CourierDistrict,
  CourierErrorCategory,
  CourierLocation,
  CourierOrderPayload,
  CourierOrderUpload,
  CourierProviderConfig,
  CourierProvince,
  CourierCity,
  CourierResult,
  CourierStatusMapping,
  CourierTracking,
  CourierTrackingEvent,
  CourierUploadedOrder,
} from "@/lib/courier/types";

// Registry + resolution helpers
export {
  courierProviderRegistry,
  getRegisteredProviders,
  isProviderRegistered,
  resolveAdapterForAccount,
  resolveCourierAdapter,
} from "@/lib/courier/registry";

// Configuration seam
export { getCourierProviderConfig, COURIER_PROVIDER_CONFIG } from "@/lib/courier/config";

// Provider-agnostic delivery -> payload mapper
export { toCourierOrderPayload } from "@/lib/courier/mappers";

// Concrete adapters
export { transExpressAdapter } from "@/lib/courier/trans-express/adapter";
