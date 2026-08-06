import { NextResponse } from 'next/server';

import { requireDeliveryAuth, internalError, mapDeliveryError } from '@/lib/api/delivery-route';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { trackShipment } from '@/lib/services/delivery.service';

export async function GET(_request: Request, { params }: { params: Promise<{ shipmentId: string }> }) {
  const guard = await requireDeliveryAuth(PERMISSIONS.DELIVERY.trackDelivery);
  if (!guard.ok) return guard.response;

  const { shipmentId } = await params;
  try {
    const tracking = await trackShipment(guard.tenantId, shipmentId, guard.userId);
    return NextResponse.json({ success: true, data: tracking });
  } catch (error) {
    console.error('GET /api/store/shipments/[shipmentId]/track error:', error);
    const mapped = mapDeliveryError(error);
    if (mapped) return mapped;
    return internalError('An unexpected error occurred');
  }
}
