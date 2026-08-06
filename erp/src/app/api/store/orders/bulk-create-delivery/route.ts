import { NextResponse } from 'next/server';

import {
  requireDeliveryAuth,
  validationError,
  internalError,
} from '@/lib/api/delivery-route';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { bulkCreateDeliveries } from '@/lib/services/order.service';
import { BulkCreateDeliverySchema } from '@/lib/validators/order.validators';

export async function POST(request: Request) {
  const guard = await requireDeliveryAuth(PERMISSIONS.DELIVERY.dispatchDelivery);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError(null, 'Invalid JSON body');
  }

  const parsed = BulkCreateDeliverySchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues, 'Validation failed');
  }

  try {
    const results = await bulkCreateDeliveries(guard.tenantId, guard.userId, parsed.data);
    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    console.error('POST /api/store/orders/bulk-create-delivery error:', error);
    return internalError('An unexpected error occurred');
  }
}
