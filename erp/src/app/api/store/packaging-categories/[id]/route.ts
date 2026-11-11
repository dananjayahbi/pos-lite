import { NextResponse } from 'next/server';

import {
  requireDeliveryAuth,
  validationError,
  internalError,
  mapDeliveryError,
} from '@/lib/api/delivery-route';
import { PERMISSIONS } from '@/lib/constants/permissions';
import {
  updatePackagingCategory,
  deletePackagingCategory,
} from '@/lib/services/packagingCategory.service';
import { UpdatePackagingCategorySchema } from '@/lib/validators/packaging.validators';

const CATEGORY_SENTINELS = new Set([
  'NOT_FOUND',
  'FORBIDDEN',
  'CATEGORY_IN_USE',
  'LAST_CATEGORY',
  'BUILT_IN_CATEGORY',
  'VALIDATION_ERROR',
]);

function categoryError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : '';
  if (CATEGORY_SENTINELS.has(message)) {
    if (message === 'NOT_FOUND') {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Category not found' } },
        { status: 404 },
      );
    }
    if (message === 'FORBIDDEN') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }
    if (message === 'CATEGORY_IN_USE') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CATEGORY_IN_USE',
            message: 'This category is used by packaging items and cannot be deleted',
          },
        },
        { status: 409 },
      );
    }
    if (message === 'LAST_CATEGORY') {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'LAST_CATEGORY', message: 'At least one category is required' },
        },
        { status: 409 },
      );
    }
    if (message === 'BUILT_IN_CATEGORY') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'BUILT_IN_CATEGORY',
            message: 'Built-in categories can be renamed but not deactivated',
          },
        },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed' } },
      { status: 400 },
    );
  }
  console.error(`${fallback} error:`, error);
  const mapped = mapDeliveryError(error);
  if (mapped) return mapped;
  return internalError('An unexpected error occurred');
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireDeliveryAuth(PERMISSIONS.DELIVERY.managePackaging);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError(null, 'Invalid JSON body');
  }

  const parsed = UpdatePackagingCategorySchema.safeParse(body);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    return validationError(errors, 'Validation failed');
  }

  try {
    const category = await updatePackagingCategory(guard.tenantId, guard.userId, id, parsed.data);
    return NextResponse.json({ success: true, data: category });
  } catch (error) {
    return categoryError(error, 'PATCH /api/store/packaging-categories/[id]');
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireDeliveryAuth(PERMISSIONS.DELIVERY.managePackaging);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  try {
    await deletePackagingCategory(guard.tenantId, guard.userId, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return categoryError(error, 'DELETE /api/store/packaging-categories/[id]');
  }
}
