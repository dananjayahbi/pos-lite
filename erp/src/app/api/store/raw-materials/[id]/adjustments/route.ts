import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { listRawMaterialAdjustments } from '@/lib/services/rawMaterial.service';
import { parseQueryInt } from '@/lib/api/query-params';
import { toErrorResponse } from '@/lib/api/error-envelope';

/**
 * GET /api/store/raw-materials/[id]/adjustments
 *
 * ARGUS #246: per-material adjustment history. Raw materials have no movement
 * table, so this projects the durable RAW_MATERIAL_STOCK_ADJUSTED audit rows.
 */
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
    const limit = parseQueryInt(request.nextUrl.searchParams, 'limit', {
      default: 50,
      min: 1,
      max: 200,
    }) ?? 50;

    const result = await listRawMaterialAdjustments(tenantId, id, limit);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof Error && error.message === 'NOT_FOUND') {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Raw material not found' } },
        { status: 404 },
      );
    }
    return toErrorResponse(error, 'GET /api/store/raw-materials/[id]/adjustments');
  }
}
