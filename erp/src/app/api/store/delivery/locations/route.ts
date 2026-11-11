import { NextResponse } from 'next/server';

import { requireDeliveryAuth, internalError, mapDeliveryError } from '@/lib/api/delivery-route';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { SRI_LANKA_CITIES } from '@/lib/constants/sri-lanka-cities';
import { getCachedLocations, syncLocations } from '@/lib/services/location-sync.service';
import { buildCustomerCityOptions } from '@/lib/utils/customer-cities';

/**
 * City options for the manual delivery form.
 *
 * The city list is sourced from the tenant's cached Trans Express master
 * locations. When no cache exists yet (courier account not configured, or the
 * locations sync has not run) we fall back to the curated Sri Lankan city list
 * so creating a manual delivery is never blocked by courier setup. Rates are
 * only calculated when a numeric city id is available, so fallback cities still
 * create a valid delivery with the card's default rate.
 */
export async function GET() {
  const guard = await requireDeliveryAuth(PERMISSIONS.DELIVERY.createDelivery);
  if (!guard.ok) return guard.response;

  const cache = await getCachedLocations(guard.tenantId);
  const { cities, source } = buildCustomerCityOptions(
    cache?.cities ?? [],
    SRI_LANKA_CITIES,
  );

  return NextResponse.json({
    success: true,
    data: {
      provinces: cache?.provinces ?? [],
      districts: cache?.districts ?? [],
      cities: cities.map((city) => ({ id: city.id ?? null, name: city.label })),
      syncedAt: cache?.syncedAt ?? null,
      source,
    },
  });
}

export async function POST() {
  const guard = await requireDeliveryAuth(PERMISSIONS.DELIVERY.manageCourierSettings);
  if (!guard.ok) return guard.response;

  try {
    const cache = await syncLocations(guard.tenantId);
    return NextResponse.json({ success: true, data: cache });
  } catch (error) {
    console.error('POST /api/store/delivery/locations error:', error);
    const mapped = mapDeliveryError(error);
    if (mapped) return mapped;
    return internalError('An unexpected error occurred');
  }
}
