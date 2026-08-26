import 'server-only';

import type Decimal from 'decimal.js';

import { prisma } from '@/lib/prisma';
import { setSentryTenantContext } from '@/lib/sentry/context';
import { calculateShippingFee } from '@/lib/services/rate-engine.service';
import { getCachedLocations } from '@/lib/services/location-sync.service';
import { resolveCityId, resolveDistrictId } from '@/lib/utils/courier';

/**
 * Delivery-fee pricing for website orders.
 *
 * Shared entry point for fee calculation across the website-order flow. It is
 * intentionally separate from the ERP manual-delivery flow (which calls the rate
 * engine directly with numeric IDs) because the website only provides free-text
 * `cityName` / `districtName`. This service resolves those names to the cached
 * numeric IDs used by the rate engine, then reuses `calculateShippingFee` so
 * there is a single source of truth for delivery pricing.
 *
 * Used by both `createWebsiteOrder` (authoritative, stored on the Delivery) and
 * the public shipping-quote route (display-only estimate before payment).
 */

export interface WebsiteShippingFeeInput {
  tenantId: string;
  /** Optional total parcel weight (kg). When omitted, base rate applies. */
  weightKg?: Decimal | string | number | null | undefined;
  cityName?: string | null | undefined;
  districtName?: string | null | undefined;
}

export interface WebsiteShippingFeeResult {
  /** Formatted to 2dp string, ready to store on `Delivery.shippingFee`. */
  shippingFee: string;
  /** Resolved numeric ids so the address snapshot can carry them too. */
  destinationCityId?: number | null | undefined;
  destinationDistrictId?: number | null | undefined;
}

/**
 * Resolve the destination district/city names to cached numeric ids, then compute
 * the shipping fee from the active rate card. Never throws for missing cache:
 * unresolved destinations fall back to the card's default base rate.
 */
export async function estimateWebsiteShippingFee(
  input: WebsiteShippingFeeInput,
): Promise<WebsiteShippingFeeResult> {
  setSentryTenantContext({ tenantId: input.tenantId });

  const cache = await getCachedLocations(input.tenantId);
  const destinationDistrictId = cache ? resolveDistrictId(cache.districts, input.districtName) : null;
  const destinationCityId = cache ? resolveCityId(cache.cities, input.cityName) : null;

  const result = await calculateShippingFee({
    tenantId: input.tenantId,
    weightKg: input.weightKg,
    destinationDistrictId,
    destinationCityId,
  });

  return {
    shippingFee: result.shippingFee.toFixed(2),
    destinationCityId,
    destinationDistrictId,
  };
}

/**
 * Load the active rate-card metadata for a tenant. Returns null when no active
 * card is configured so callers can signal "delivery free / not priced".
 */
export async function getActiveRateCard(tenantId: string) {
  return prisma.rateCard.findFirst({
    where: { tenantId, isActive: true },
    orderBy: { updatedAt: 'desc' },
  });
}
