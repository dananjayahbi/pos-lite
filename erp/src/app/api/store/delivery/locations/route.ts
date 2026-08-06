import { NextResponse } from 'next/server';

import { requireDeliveryAuth, internalError, mapDeliveryError } from '@/lib/api/delivery-route';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { getCachedLocations, syncLocations } from '@/lib/services/location-sync.service';

export async function GET() {
  const guard = await requireDeliveryAuth(PERMISSIONS.DELIVERY.manageCourierSettings);
  if (!guard.ok) return guard.response;

  const cache = await getCachedLocations(guard.tenantId);
  return NextResponse.json({ success: true, data: cache });
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
