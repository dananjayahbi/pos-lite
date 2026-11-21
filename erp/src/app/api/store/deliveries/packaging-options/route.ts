import { NextResponse } from 'next/server';

import { requireDeliveryAuth, internalError } from '@/lib/api/delivery-route';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { getPackagingDispatchOptions } from '@/lib/services/packaging.service';

/**
 * ARGUS #283: read-only packaging options for the dispatch sheet.
 *
 * Uses the dispatch permission (not packaging-management) so dispatch staff can
 * see the suggested items and choose what this parcel actually consumes.
 */
export async function GET() {
  const guard = await requireDeliveryAuth(PERMISSIONS.DELIVERY.dispatchDelivery);
  if (!guard.ok) return guard.response;

  try {
    const items = await getPackagingDispatchOptions(guard.tenantId);
    return NextResponse.json({ success: true, data: items });
  } catch (error) {
    console.error('GET /api/store/deliveries/packaging-options error:', error);
    return internalError('An unexpected error occurred');
  }
}
