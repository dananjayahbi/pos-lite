import 'server-only';

import { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { setSentryTenantContext } from '@/lib/sentry/context';
import { transExpressAdapter } from '@/lib/courier';
import { resolveCityId } from '@/lib/utils/courier';
import type { CourierCity } from '@/lib/courier/types';

interface LocationCache {
  provinces: { id: number; text: string }[];
  districts: { id: number; text: string }[];
  cities: { id: number; text: string }[];
  syncedAt: string;
}

/**
 * Location sync service. Trans Express provides master province/district/city
 * data that feeds checkout/delivery dropdowns and city→id resolution. The
 * hierarchy is cached on the tenant settings (JSON) and refreshed monthly via
 * cron or manually from the delivery settings UI.
 */

function readCache(settings: unknown): LocationCache | null {
  if (!settings || typeof settings !== 'object') return null;
  const delivery = (settings as Record<string, unknown>).delivery;
  if (!delivery || typeof delivery !== 'object') return null;
  const cache = (delivery as Record<string, unknown>).locations as LocationCache | undefined;
  return cache ?? null;
}

export async function getCachedLocations(tenantId: string): Promise<LocationCache | null> {
  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  return readCache(tenant?.settings);
}

export async function getCachedCities(tenantId: string): Promise<CourierCity[]> {
  const cache = await getCachedLocations(tenantId);
  return cache?.cities ?? [];
}

/** Resolve a text city to its Trans Express city_id from the cache. */
export async function resolveCityToId(tenantId: string, cityName?: string | null): Promise<number | null> {
  if (!cityName) return null;
  const cities = await getCachedCities(tenantId);
  return resolveCityId(cities, cityName);
}

/** Pull the full hierarchy from Trans Express and cache it on the tenant. */
export async function syncLocations(tenantId: string): Promise<LocationCache> {
  setSentryTenantContext({ tenantId });

  // Locations are read-only master data and don't require the account to be
  // "active" for dispatch — just that a courier account exists with credentials.
  const account = await prisma.courierAccount.findFirst({ where: { tenantId } });
  if (!account) throw new Error('COURIER_ACCOUNT_NOT_CONFIGURED');
  if (!account.email && !account.apiKey) throw new Error('COURIER_CREDENTIALS_MISSING');

  const auth = await transExpressAdapter.authenticate({
    email: account.email ?? undefined,
    password: account.password ?? undefined,
    apiKey: account.apiKey ?? undefined,
    env: account.env,
  });
  if (!auth.ok) throw new Error(`COURIER_AUTH_FAILED:${auth.error.message}`);

  const result = await transExpressAdapter.syncLocations(account.env, auth.data);
  if (!result.ok) throw new Error(`LOCATION_SYNC_FAILED:${result.error.message}`);

  const cache: LocationCache = {
    provinces: result.data.provinces,
    districts: result.data.districts,
    cities: result.data.cities,
    syncedAt: new Date().toISOString(),
  };

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { settings: true } });
  const currentSettings = (tenant?.settings ?? {}) as Record<string, unknown>;
  const deliverySettings =
    currentSettings.delivery && typeof currentSettings.delivery === 'object'
      ? { ...(currentSettings.delivery as Record<string, unknown>) }
      : {};

  const nextSettings: Prisma.InputJsonValue = {
    ...currentSettings,
    delivery: { ...deliverySettings, locations: cache as unknown as Prisma.InputJsonValue },
  };

  await prisma.tenant.update({
    where: { id: tenantId },
    data: { settings: nextSettings },
  });

  return cache;
}
