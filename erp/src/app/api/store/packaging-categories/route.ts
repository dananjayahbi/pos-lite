import { NextResponse } from 'next/server';

import {
  requireDeliveryAuth,
  validationError,
  internalError,
  mapDeliveryError,
} from '@/lib/api/delivery-route';
import { PERMISSIONS } from '@/lib/constants/permissions';
import {
  listPackagingCategories,
  createPackagingCategory,
} from '@/lib/services/packagingCategory.service';
import { CreatePackagingCategorySchema } from '@/lib/validators/packaging.validators';

export async function GET() {
  const guard = await requireDeliveryAuth(PERMISSIONS.DELIVERY.managePackaging);
  if (!guard.ok) return guard.response;

  try {
    const categories = await listPackagingCategories(guard.tenantId);
    return NextResponse.json({ success: true, data: categories });
  } catch (error) {
    console.error('GET /api/store/packaging-categories error:', error);
    return internalError('An unexpected error occurred');
  }
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

  const parsed = CreatePackagingCategorySchema.safeParse(body);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    return validationError(errors, 'Validation failed');
  }

  try {
    const category = await createPackagingCategory(guard.tenantId, guard.userId, parsed.data);
    return NextResponse.json({ success: true, data: category }, { status: 201 });
  } catch (error) {
    console.error('POST /api/store/packaging-categories error:', error);
    const mapped = mapDeliveryError(error);
    if (mapped) return mapped;
    return internalError('An unexpected error occurred');
  }
}
