import { NextResponse } from 'next/server';

import { requireDeliveryAuth, validationError, internalError, mapDeliveryError } from '@/lib/api/delivery-route';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { getDeliveries, createDelivery } from '@/lib/services/delivery.service';
import { CreateDeliverySchema, DeliveryFiltersSchema } from '@/lib/validators/delivery.validators';
import type { CreateDeliveryInput } from '@/lib/validators/delivery.validators';

export async function GET(request: Request) {
  const guard = await requireDeliveryAuth(PERMISSIONS.DELIVERY.viewDelivery);
  if (!guard.ok) return guard.response;

  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries());
  const parsed = DeliveryFiltersSchema.safeParse(params);
  if (!parsed.success) {
    return validationError(parsed.error.issues, 'Invalid filter parameters');
  }

  const data = await getDeliveries(guard.tenantId, parsed.data);
  return NextResponse.json({ success: true, data });
}

export async function POST(request: Request) {
  const guard = await requireDeliveryAuth(PERMISSIONS.DELIVERY.createDelivery);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError(null, 'Invalid JSON body');
  }

  const parsed = CreateDeliverySchema.safeParse(body);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    return validationError(errors, 'Validation failed');
  }

  try {
    const delivery = await createDelivery(guard.tenantId, guard.userId, parsed.data as CreateDeliveryInput);
    return NextResponse.json({ success: true, data: delivery }, { status: 201 });
  } catch (error) {
    console.error('POST /api/store/deliveries error:', error);
    const mapped = mapDeliveryError(error);
    if (mapped) return mapped;
    return internalError('An unexpected error occurred');
  }
}
