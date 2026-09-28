import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import {
  listRawMaterials,
  createRawMaterial,
  type ListRawMaterialsFilters,
} from '@/lib/services/rawMaterial.service';
import { CreateRawMaterialSchema } from '@/lib/validators/rawMaterial.validators';
import { RAW_MATERIAL_CATEGORIES } from '@/lib/services/rawMaterial.core';
import { toErrorResponse } from '@/lib/api/error-envelope';
import { parseQueryInt } from '@/lib/api/query-params';

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
    if (!hasPermission(session.user, PERMISSIONS.RAW_MATERIAL.viewRawMaterial)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') ?? undefined;
    const categoryRaw = searchParams.get('category') ?? undefined;
    const stockStatus = searchParams.get('stockStatus') ?? undefined;
    // XC-01: Math.max(1,Number('abc')) is NaN — malformed page/limit now 400.
    const page = parseQueryInt(searchParams, 'page', { default: 1, min: 1 }) ?? 1;
    const limit = parseQueryInt(searchParams, 'limit', { default: 25, min: 1, max: 100 }) ?? 25;

    const filters: ListRawMaterialsFilters = { search, page, limit };
    if (
      categoryRaw &&
      (RAW_MATERIAL_CATEGORIES as string[]).includes(categoryRaw)
    ) {
      filters.category = categoryRaw as ListRawMaterialsFilters['category'];
    }
    if (stockStatus === 'OK' || stockStatus === 'LOW' || stockStatus === 'OUT') {
      filters.stockStatus = stockStatus;
    }

    const result = await listRawMaterials(tenantId, filters);
    const totalPages = Math.ceil(result.total / limit);

    return NextResponse.json({
      success: true,
      data: result.items,
      meta: { page, limit, total: result.total, totalPages },
    });
  } catch (error) {
    // XC-01/INF-02: parser ApiErrors surface as their 400; unknown
    // errors are logged and returned as a generic, leak-free 500.
    return toErrorResponse(error, 'GET /api/store/raw-materials');
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
    if (!hasPermission(session.user, PERMISSIONS.RAW_MATERIAL.createRawMaterial)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const body: unknown = await request.json();
    const parsed = CreateRawMaterialSchema.safeParse(body);
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

    const material = await createRawMaterial(tenantId, session.user.id, parsed.data);
    return NextResponse.json({ success: true, data: material }, { status: 201 });
  } catch (error) {
    // XC-01/INF-02: parser ApiErrors surface as their 400; unknown
    // errors are logged and returned as a generic, leak-free 500.
    return toErrorResponse(error, 'POST /api/store/raw-materials');
  }
}
