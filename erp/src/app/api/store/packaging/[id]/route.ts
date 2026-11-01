import { NextResponse } from 'next/server';

import {
  requireDeliveryAuth,
  validationError,
  internalError,
  mapDeliveryError,
} from '@/lib/api/delivery-route';
import { PERMISSIONS } from '@/lib/constants/permissions';
import {
  updatePackagingItem,
  adjustPackagingStock,
  deletePackagingItem,
} from '@/lib/services/packaging.service';
import {
  UpdatePackagingItemSchema,
  PackagingStockAdjustSchema,
} from '@/lib/validators/packaging.validators';
import type { UpdatePackagingItemInput } from '@/lib/validators/packaging.validators';

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

  const parsed = UpdatePackagingItemSchema.safeParse(body);
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    return validationError(errors, 'Validation failed');
  }

  try {
    const item = await updatePackagingItem(
      guard.tenantId,
      id,
      guard.userId,
      parsed.data as UpdatePackagingItemInput,
    );
    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    console.error('PATCH /api/store/packaging/[id] error:', error);
    const mapped = mapDeliveryError(error);
    if (mapped) return mapped;
    return internalError('An unexpected error occurred');
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireDeliveryAuth(PERMISSIONS.DELIVERY.dispatchPackaging);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError(null, 'Invalid JSON body');
  }

  const parsed = PackagingStockAdjustSchema.safeParse(body ?? {});
  if (!parsed.success) {
    const errors = parsed.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    return validationError(errors, 'Validation failed');
  }

  try {
    const item = await adjustPackagingStock(
      guard.tenantId,
      id,
      guard.userId,
      parsed.data.delta,
      parsed.data.note,
    );
    return NextResponse.json({ success: true, data: item });
  } catch (error) {
    console.error('POST /api/store/packaging/[id]/adjust error:', error);
    const mapped = mapDeliveryError(error);
    if (mapped) return mapped;
    return internalError('An unexpected error occurred');
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireDeliveryAuth(PERMISSIONS.DELIVERY.managePackaging);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  try {
    await deletePackagingItem(guard.tenantId, id, guard.userId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/store/packaging/[id] error:', error);
    const mapped = mapDeliveryError(error);
    if (mapped) return mapped;
    return internalError('An unexpected error occurred');
  }
}
