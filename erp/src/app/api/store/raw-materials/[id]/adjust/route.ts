import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { adjustRawMaterialStock } from '@/lib/services/rawMaterial.service';
import { AdjustRawMaterialStockSchema } from '@/lib/validators/rawMaterial.validators';

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
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
    if (!hasPermission(session.user, PERMISSIONS.RAW_MATERIAL.adjustRawMaterialStock)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { id } = await context.params;
    const body: unknown = await request.json();
    const parsed = AdjustRawMaterialStockSchema.safeParse(body);
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

    const material = await adjustRawMaterialStock(
      tenantId,
      session.user.id,
      id,
      parsed.data.quantityDelta,
    );
    return NextResponse.json({ success: true, data: material });
  } catch (error) {
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
    if (error instanceof Error && error.message === 'DELTA_ZERO') {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Quantity delta must not be zero' } },
        { status: 400 },
      );
    }
    if (error instanceof Error && error.message.startsWith('Insufficient stock')) {
      return NextResponse.json(
        { success: false, error: { code: 'BELOW_ZERO', message: error.message } },
        { status: 400 },
      );
    }
    console.error('POST /api/store/raw-materials/[id]/adjust error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
