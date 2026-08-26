import { NextResponse } from 'next/server';

import {
  requireDeliveryAuth,
  validationError,
  internalError,
} from '@/lib/api/delivery-route';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { bulkChangeOrderStatus } from '@/lib/services/order.service';
import { BulkStatusChangeSchema } from '@/lib/validators/order.validators';

export async function POST(request: Request) {
  const guard = await requireDeliveryAuth(PERMISSIONS.DELIVERY.editDelivery);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError(null, 'Invalid JSON body');
  }

  const parsed = BulkStatusChangeSchema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues, 'Validation failed');
  }

  try {
    const results = await bulkChangeOrderStatus(guard.tenantId, guard.userId, parsed.data);
    return NextResponse.json({ success: true, data: results });
  } catch (error) {
    console.error('POST /api/store/orders/bulk-status error:', error);
    return internalError('An unexpected error occurred');
  }
}
