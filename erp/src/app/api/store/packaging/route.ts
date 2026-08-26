import { NextResponse } from 'next/server';

import { requireDeliveryAuth, validationError, internalError, mapDeliveryError } from '@/lib/api/delivery-route';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { getPackagingItems, createPackagingItem } from '@/lib/services/packaging.service';
import { CreatePackagingItemSchema } from '@/lib/validators/packaging.validators';
import type { CreatePackagingItemInput } from '@/lib/validators/packaging.validators';

export async function GET() {
  const guard = await requireDeliveryAuth(PERMISSIONS.DELIVERY.managePackaging);
  if (!guard.ok) return guard.response;

  const items = await getPackagingItems(guard.tenantId);
  return NextResponse.json({ success: true, data: items });
}

export async function POST(request: Request) {
  const guard = await requireDeliveryAuth(PERMISSIONS.DELIVERY.managePackaging);
  if (!guard.ok) return guard.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError(null, 'Invalid JSON body');
  }

  const parsed = CreatePackagingItemSchema.safeParse(body);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    return validationError(errors, 'Validation failed');
  }

  try {
    const item = await createPackagingItem(guard.tenantId, parsed.data as CreatePackagingItemInput);
    return NextResponse.json({ success: true, data: item }, { status: 201 });
  } catch (error) {
    console.error('POST /api/store/packaging error:', error);
    const mapped = mapDeliveryError(error);
    if (mapped) return mapped;
    return internalError('An unexpected error occurred');
  }
}
