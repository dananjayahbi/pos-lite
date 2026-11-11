import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import {
  updateRawMaterialUnit,
  deleteRawMaterialUnit,
} from '@/lib/services/rawMaterialUnit.service';
import { UpdateRawMaterialUnitSchema } from '@/lib/validators/rawMaterial.validators';

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof Error) {
    switch (error.message) {
      case 'NOT_FOUND':
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Unit not found' } },
          { status: 404 },
        );
      case 'FORBIDDEN':
        return NextResponse.json(
          { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
          { status: 403 },
        );
      case 'UNIT_IN_USE':
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'UNIT_IN_USE',
              message: 'This unit is used by raw materials and cannot be deleted',
            },
          },
          { status: 409 },
        );
      case 'LAST_UNIT':
        return NextResponse.json(
          {
            success: false,
            error: { code: 'LAST_UNIT', message: 'At least one unit is required' },
          },
          { status: 409 },
        );
      case 'BUILT_IN_UNIT':
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'BUILT_IN_UNIT',
              message: 'Built-in units can be renamed but not deactivated',
            },
          },
          { status: 400 },
        );
      case 'VALIDATION_ERROR':
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed' } },
          { status: 400 },
        );
      default:
        break;
    }
  }
  console.error(`${fallback} error:`, error);
  return NextResponse.json(
    { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
    { status: 500 },
  );
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }
    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'No tenant associated' } },
        { status: 401 },
      );
    }
    if (!hasPermission(session.user, PERMISSIONS.RAW_MATERIAL.editRawMaterial)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { id } = await context.params;
    const body: unknown = await request.json();
    const parsed = UpdateRawMaterialUnitSchema.safeParse(body);
    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: errors } },
        { status: 400 },
      );
    }

    const unit = await updateRawMaterialUnit(tenantId, session.user.id, id, parsed.data);
    return NextResponse.json({ success: true, data: unit });
  } catch (error) {
    return errorResponse(error, 'PATCH /api/store/units/[id]');
  }
}

export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }
    const tenantId = session.user.tenantId;
    if (!tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'No tenant associated' } },
        { status: 401 },
      );
    }
    if (!hasPermission(session.user, PERMISSIONS.RAW_MATERIAL.deleteRawMaterial)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { id } = await context.params;
    await deleteRawMaterialUnit(tenantId, session.user.id, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    return errorResponse(error, 'DELETE /api/store/units/[id]');
  }
}
