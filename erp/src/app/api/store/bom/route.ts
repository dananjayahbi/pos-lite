import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { listBoms, createBom } from '@/lib/services/bom.service';
import { CreateBomSchema } from '@/lib/validators/bom.validators';

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
    if (!hasPermission(session.user, PERMISSIONS.BOM.viewBom)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const variantId = searchParams.get('variantId') ?? undefined;
    const search = searchParams.get('search') ?? undefined;
    const page = Math.max(1, Number(searchParams.get('page') ?? '1'));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? '25')));

    const result = await listBoms(tenantId, { variantId, search, page, limit });
    const totalPages = Math.ceil(result.total / limit);

    return NextResponse.json({
      success: true,
      data: result.items,
      meta: { page, limit, total: result.total, totalPages },
    });
  } catch (error) {
    console.error('GET /api/store/bom error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}

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
    if (!hasPermission(session.user, PERMISSIONS.BOM.createBom)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const body: unknown = await request.json();
    const parsed = CreateBomSchema.safeParse(body);
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

    const bom = await createBom(tenantId, session.user.id, parsed.data);
    return NextResponse.json({ success: true, data: bom }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'NO_INGREDIENTS') {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'A BOM requires at least one ingredient' } },
        { status: 400 },
      );
    }
    if (message === 'BOM_EXISTS') {
      return NextResponse.json(
        { success: false, error: { code: 'CONFLICT', message: 'A BOM already exists for this product variant' } },
        { status: 409 },
      );
    }
    if (message === 'VARIANT_NOT_FOUND') {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Product variant not found' } },
        { status: 404 },
      );
    }
    if (message === 'INGREDIENT_NOT_FOUND') {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'One or more raw materials not found' } },
        { status: 404 },
      );
    }
    if (message === 'TRADED_NOT_MANUFACTURED') {
      return NextResponse.json(
        { success: false, error: { code: 'UNPROCESSABLE_ENTITY', message: 'BOMs are only available for manufactured products' } },
        { status: 422 },
      );
    }
    console.error('POST /api/store/bom error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
