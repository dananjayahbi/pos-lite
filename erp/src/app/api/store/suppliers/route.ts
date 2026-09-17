import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { toErrorResponse } from '@/lib/api/error-envelope';
import { parseQueryInt, parseQueryBool } from '@/lib/api/query-params';
import { getSuppliers, createSupplier } from '@/lib/services/supplier.service';
import { CreateSupplierSchema } from '@/lib/validators/supplier.validators';
import type { CreateSupplierInput } from '@/lib/validators/supplier.validators';

export async function GET(request: Request) {
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

    if (!hasPermission(session.user, PERMISSIONS.SUPPLIER.viewSupplier)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);

    const result = await getSuppliers(tenantId, {
      search: searchParams.get('search') ?? undefined,
      // XC-01: malformed page/limit now 400 (BUG-32); out-of-range clamps.
      page: parseQueryInt(searchParams, 'page', { min: 1, max: 1_000_000 }),
      limit: parseQueryInt(searchParams, 'limit', { min: 1, max: 200 }),
      includeArchived: parseQueryBool(searchParams, 'includeArchived') ?? false,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return toErrorResponse(error, 'GET /api/store/suppliers');
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

    if (!hasPermission(session.user, PERMISSIONS.SUPPLIER.createSupplier)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = CreateSupplierSchema.safeParse(body);

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

    const supplier = await createSupplier(tenantId, parsed.data as CreateSupplierInput);

    return NextResponse.json({ success: true, data: supplier }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';

    if (message.includes('Invalid phone')) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message } },
        { status: 400 },
      );
    }

    // M06-01 (BUG-30 / INF-02): duplicate-phone pre-check throws
    // ApiError.conflict (409, friendly message preserved); a concurrent race
    // loser hits @@unique([tenantId, phone]) and mapPrismaError turns P2002
    // into 409 CONFLICT. Anything else is a logged generic 500 — never a
    // raw-dump echo.
    return toErrorResponse(error, 'POST /api/store/suppliers');
  }
}
