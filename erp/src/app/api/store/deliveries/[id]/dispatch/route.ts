import { NextResponse } from 'next/server';

import { requireDeliveryAuth, validationError, internalError, mapDeliveryError } from '@/lib/api/delivery-route';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { dispatchDelivery } from '@/lib/services/delivery.service';
import { DispatchDeliverySchema } from '@/lib/validators/delivery.validators';
import type { DispatchDeliveryInput } from '@/lib/validators/delivery.validators';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireDeliveryAuth(PERMISSIONS.DELIVERY.dispatchDelivery);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError(null, 'Invalid JSON body');
  }

  const parsed = DispatchDeliverySchema.safeParse(body ?? {});
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    return validationError(errors, 'Validation failed');
  }

  try {
    const delivery = await dispatchDelivery(guard.tenantId, id, guard.userId, parsed.data as DispatchDeliveryInput);
    return NextResponse.json({ success: true, data: delivery });
  } catch (error) {
    console.error('POST /api/store/deliveries/[id]/dispatch error:', error);
    const mapped = mapDeliveryError(error);
    if (mapped) return mapped;
    return internalError('An unexpected error occurred');
  }
}
