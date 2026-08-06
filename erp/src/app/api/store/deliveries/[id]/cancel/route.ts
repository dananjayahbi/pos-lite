import { NextResponse } from 'next/server';

import { requireDeliveryAuth, validationError, internalError, mapDeliveryError } from '@/lib/api/delivery-route';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { cancelDelivery } from '@/lib/services/delivery.service';
import { CancelDeliverySchema } from '@/lib/validators/delivery.validators';
import type { CancelDeliveryInput } from '@/lib/validators/delivery.validators';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireDeliveryAuth(PERMISSIONS.DELIVERY.cancelDelivery);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError(null, 'Invalid JSON body');
  }

  const parsed = CancelDeliverySchema.safeParse(body ?? {});
  if (!parsed.success) {
    return validationError(parsed.error.issues, 'Validation failed');
  }

  try {
    const delivery = await cancelDelivery(guard.tenantId, id, guard.userId, parsed.data as CancelDeliveryInput);
    return NextResponse.json({ success: true, data: delivery });
  } catch (error) {
    console.error('POST /api/store/deliveries/[id]/cancel error:', error);
    const mapped = mapDeliveryError(error);
    if (mapped) return mapped;
    return internalError('An unexpected error occurred');
  }
}
