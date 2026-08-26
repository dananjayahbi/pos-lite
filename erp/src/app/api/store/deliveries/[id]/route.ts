import { NextResponse } from 'next/server';

import { requireDeliveryAuth, validationError, internalError, mapDeliveryError } from '@/lib/api/delivery-route';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { getDeliveryById, updateDelivery } from '@/lib/services/delivery.service';
import { UpdateDeliverySchema } from '@/lib/validators/delivery.validators';
import type { UpdateDeliveryInput } from '@/lib/validators/delivery.validators';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireDeliveryAuth(PERMISSIONS.DELIVERY.viewDelivery);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  try {
    const delivery = await getDeliveryById(guard.tenantId, id);
    return NextResponse.json({ success: true, data: delivery });
  } catch (error) {
    const mapped = mapDeliveryError(error);
    if (mapped) return mapped;
    return internalError('An unexpected error occurred');
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireDeliveryAuth(PERMISSIONS.DELIVERY.editDelivery);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError(null, 'Invalid JSON body');
  }

  const parsed = UpdateDeliverySchema.safeParse(body);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    return validationError(errors, 'Validation failed');
  }

  try {
    const delivery = await updateDelivery(guard.tenantId, id, guard.userId, parsed.data as UpdateDeliveryInput);
    return NextResponse.json({ success: true, data: delivery });
  } catch (error) {
    console.error('PATCH /api/store/deliveries/[id] error:', error);
    const mapped = mapDeliveryError(error);
    if (mapped) return mapped;
    return internalError('An unexpected error occurred');
  }
}
