import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import {
  updateRawMaterial,
  deleteRawMaterial,
  toRawMaterialItem,
} from '@/lib/services/rawMaterial.service';
import { UpdateRawMaterialSchema } from '@/lib/validators/rawMaterial.validators';
import { getRawMaterialCategoryNameMap } from '@/lib/services/rawMaterialCategory.service';
import { getRawMaterialUnitMap } from '@/lib/services/rawMaterialUnit.service';
import { isApiError } from '@/lib/api/errors';
import { envelopeError } from '@/lib/api/error-envelope';

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

    // ARGUS #241: an absolute quantity overwrite through the edit form bypasses
    // the adjustment workflow (no delta, no reason, no stock audit). Reject it
    // explicitly rather than silently dropping the field.
    if (body !== null && typeof body === 'object' && 'quantity' in body) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'RAW_MATERIAL_QUANTITY_READ_ONLY',
            message:
              'Quantity cannot be edited directly. Use Adjust stock so the change records a delta and a reason.',
          },
        },
        { status: 400 },
      );
    }

    const parsed = UpdateRawMaterialSchema.safeParse(body);
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

    const material = await updateRawMaterial(tenantId, session.user.id, id, parsed.data);
    return NextResponse.json({ success: true, data: material });
  } catch (error) {
    // ARGUS #241: guard violations arrive as typed ApiErrors (409) with the
    // operator-facing explanation intact.
    if (isApiError(error)) return envelopeError(error);
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Raw material not found' } },
        { status: 404 },
      );
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }
    if (error instanceof Error && error.message === 'CATEGORY_NOT_FOUND') {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Unknown raw material category' } },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message === 'UNIT_NOT_FOUND') {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Unknown raw material unit' } },
        { status: 400 },
      );
    }
    console.error('PATCH /api/store/raw-materials/[id] error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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
    await deleteRawMaterial(tenantId, session.user.id, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    // ARGUS #241: RAW_MATERIAL_HAS_STOCK / RAW_MATERIAL_IN_BOM are typed 409s.
    if (isApiError(error)) return envelopeError(error);
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Raw material not found' } },
        { status: 404 },
      );
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }
    console.error('DELETE /api/store/raw-materials/[id] error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}

// Single-material detail read. M21-01 (BUG-55): returns the same full DTO the
// list uses (quantity, lowStockThreshold, stockStatus, …) — not an id-only
// existence check — so detail and list surfaces agree byte-for-byte.
export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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
    if (!hasPermission(session.user, PERMISSIONS.RAW_MATERIAL.viewRawMaterial)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { id } = await context.params;
    const material = await prisma.rawMaterial.findFirst({
      where: { id, tenantId, deletedAt: null },
    });
    if (!material) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Raw material not found' } },
        { status: 404 },
      );
    }
    const categoryNames = await getRawMaterialCategoryNameMap(tenantId);
    const unitMap = await getRawMaterialUnitMap(tenantId);
    return NextResponse.json({
      success: true,
      data: toRawMaterialItem(
        material,
        categoryNames.get(material.category),
        unitMap.get(material.unit),
      ),
    });
  } catch (error) {
    console.error('GET /api/store/raw-materials/[id] error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
