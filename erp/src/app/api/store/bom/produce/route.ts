import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { planProduction, produceGoods } from '@/lib/services/bom.service';
import { ProduceGoodsSchema } from '@/lib/validators/bom.validators';

export async function POST(request: Request) {
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
    if (!hasPermission(session.user, PERMISSIONS.BOM.produceGoods)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const body: unknown = await request.json();
    const parsed = ProduceGoodsSchema.safeParse(body);
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

    const result = await produceGoods(
      tenantId,
      session.user.id,
      parsed.data.bomId,
      parsed.data.quantity,
      parsed.data.note,
    );
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.startsWith('INSUFFICIENT_STOCK:')) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INSUFFICIENT_STOCK',
            message: 'Insufficient raw material stock to complete this production run',
          },
        },
        { status: 409 },
      );
    }
    if (message === 'BOM_INACTIVE') {
      return NextResponse.json(
        { success: false, error: { code: 'CONFLICT', message: 'This BOM is inactive' } },
        { status: 409 },
      );
    }
    if (message === 'NOT_FOUND') {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Bill of materials not found' } },
        { status: 404 },
      );
    }
    if (message === 'FORBIDDEN') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }
    if (message === 'TRADED_NOT_MANUFACTURED') {
      return NextResponse.json(
        { success: false, error: { code: 'UNPROCESSABLE_ENTITY', message: 'Production is only available for manufactured products' } },
        { status: 422 },
      );
    }
    console.error('POST /api/store/bom/produce error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}

/** Return a full consumption plan for the given BOM + quantity, without mutating. */
export async function GET(request: NextRequest) {
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
    if (!hasPermission(session.user, PERMISSIONS.BOM.produceGoods)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const bomId = searchParams.get('bomId');
    const quantity = Number(searchParams.get('quantity') ?? '0');
    if (!bomId) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'bomId is required' } },
        { status: 400 },
      );
    }
    if (!Number.isInteger(quantity) || quantity <= 0) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'quantity must be a positive integer' } },
        { status: 400 },
      );
    }

    const plan = await planProduction(tenantId, bomId, quantity);
    return NextResponse.json({ success: true, data: plan });
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Bill of materials not found' } },
        { status: 404 },
      );
    }
    if (error instanceof Error && error.message === 'FORBIDDEN') {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }
    console.error('GET /api/store/bom/produce error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
