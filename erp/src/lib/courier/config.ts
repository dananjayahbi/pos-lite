import "server-only";

import { TRANSEXPRESS_BASE_URLS } from "@/lib/constants/courier";
import type { CourierProviderConfig } from "@/lib/courier/types";
import type { CarrierProvider } from "@/generated/prisma/client";

/**
 * Courier provider configuration seam.
 *
 * Holds static, per-provider metadata (labels, auth credential fields, base
 * URLs, notification hooks) so providers are not hardcoded into consumers.
 * Credentials themselves live on the DB-backed `CourierAccount` (email /
 * password / apiKey + env) — this module documents the shape each provider
 * needs and resolves the provider-agnostic config for a given provider value.
 *
 * Only Trans Express is currently integrated. Domex / PromptX / Koombiyo are
 * declared (matching the `CarrierProvider` enum) with `implemented: false` and
 * no base URLs, so the configuration surface exists for them without
 * fabricating integrations that don't exist yet.
 */

export const COURIER_PROVIDER_CONFIG: Record<CarrierProvider, CourierProviderConfig> = {
  TRANSEXPRESS: {
    provider: "TRANSEXPRESS",
    label: "Trans Express",
    implemented: true,
    authFields: ["email", "password", "apiKey"],
    baseUrls: TRANSEXPRESS_BASE_URLS,
    hooks: {},
  },
  DOMEX: {
    provider: "DOMEX",
    label: "Domex",
    implemented: false,
    authFields: ["apiKey"],
    baseUrls: {},
    hooks: {
      statusWebhook: "/api/courier/webhooks/domex/status",
    },
  },
  PROMPTX: {
    provider: "PROMPTX",
    label: "PromptX",
    implemented: false,
    authFields: ["email", "password", "apiKey"],
    baseUrls: {},
  },
  KOOMBIYO: {
    provider: "KOOMBIYO",
    label: "Koombiyo",
    implemented: false,
    authFields: ["email", "password"],
    baseUrls: {},
  },
};

/** Resolve the configuration metadata for a provider value. */
export function getCourierProviderConfig(provider: CarrierProvider): CourierProviderConfig {
  return COURIER_PROVIDER_CONFIG[provider];
}
