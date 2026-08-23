import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { listProductionLogs } from '@/lib/services/bom.service';

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
    if (!hasPermission(session.user, PERMISSIONS.BOM.viewProductionLog)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const bomId = searchParams.get('bomId') ?? undefined;
    const variantId = searchParams.get('variantId') ?? undefined;
    const page = Math.max(1, Number(searchParams.get('page') ?? '1'));
    const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') ?? '25')));

    const result = await listProductionLogs(tenantId, {
      ...(bomId !== undefined ? { bomId } : {}),
      ...(variantId !== undefined ? { variantId } : {}),
      page,
      limit,
    });
    const totalPages = Math.ceil(result.total / limit);

    return NextResponse.json({
      success: true,
      data: result.items,
      meta: { page, limit, total: result.total, totalPages },
    });
  } catch (error) {
    console.error('GET /api/store/bom/production error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
