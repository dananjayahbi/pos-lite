import "server-only";

import { transExpressAdapter } from "@/lib/courier/trans-express/adapter";
import type { CourierAdapter } from "@/lib/courier/types";
import type { CarrierProvider } from "@/generated/prisma/client";

/**
 * Courier provider registry.
 *
 * Maps a `CarrierProvider` enum value to its concrete `CourierAdapter`.
 * Services resolve a provider through `resolveCourierAdapter()` (or
 * `resolveAdapterForAccount()`) instead of importing a specific adapter, so a
 * new carrier is added by registering an adapter here — no consumer changes.
 *
 * Only providers with a real integration are registered. The enum may contain
 * additional values (e.g. DOMEX/PROMPTX/KOOMBIYO) for future providers; calling
 * resolve on an unregistered provider throws `UNSUPPORTED_COURIER_PROVIDER`.
 */
export const courierProviderRegistry: Partial<Record<CarrierProvider, CourierAdapter>> = {
  TRANSEXPRESS: transExpressAdapter,
};

/** Registered providers (keys that have a concrete adapter). */
export function getRegisteredProviders(): CarrierProvider[] {
  return (Object.keys(courierProviderRegistry) as CarrierProvider[]).filter(
    (p) => courierProviderRegistry[p] !== undefined,
  );
}

/** Whether a provider has a concrete adapter registered. */
export function isProviderRegistered(provider: CarrierProvider): boolean {
  return courierProviderRegistry[provider] !== undefined;
}

/**
 * Resolve a provider to its adapter, throwing if it has not been integrated.
 * Callers that may hit unregistered providers should guard with
 * `isProviderRegistered()` first.
 */
export function resolveCourierAdapter(provider: CarrierProvider): CourierAdapter {
  const adapter = courierProviderRegistry[provider];
  if (!adapter) {
    throw new Error(`UNSUPPORTED_COURIER_PROVIDER:${provider}`);
  }
  return adapter;
}

/**
 * Resolve the adapter for a persisted CourierAccount by its `provider` field.
 * Convenience for services that already load the account from the database.
 */
export function resolveAdapterForAccount(account: { provider: CarrierProvider }): CourierAdapter {
  return resolveCourierAdapter(account.provider);
}
