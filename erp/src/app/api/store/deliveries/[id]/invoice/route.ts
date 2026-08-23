import { NextResponse } from 'next/server';

import {
  requireDeliveryAuth,
  internalError,
  mapDeliveryError,
} from '@/lib/api/delivery-route';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { getOrderInvoiceData } from '@/lib/services/order-invoice.service';

// ─── GET /api/store/deliveries/[id]/invoice ────────────────────────────────
// Returns the assembled printable order/shipping invoice payload for a
// delivery: line items, customer, shipping address, shipping fee and totals,
// plus tenant branding. Gated on the delivery view permission.
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const guard = await requireDeliveryAuth(PERMISSIONS.DELIVERY.viewDelivery);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  try {
    const data = await getOrderInvoiceData(guard.tenantId, id);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const mapped = mapDeliveryError(error);
    if (mapped) return mapped;
    return internalError('An unexpected error occurred');
  }
}
