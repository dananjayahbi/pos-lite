import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { getCustomers, createCustomer } from '@/lib/services/customer.service';
import { CreateCustomerSchema } from '@/lib/validators/customer.validators';
import type { CreateCustomerInput } from '@/lib/validators/customer.validators';
import { toErrorResponse } from '@/lib/api/error-envelope';
import { parseQueryInt, parseQueryNumber, parseQueryBool } from '@/lib/api/query-params';

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

    if (!hasPermission(session.user, PERMISSIONS.CUSTOMER.viewCustomer)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);

    const result = await getCustomers(tenantId, {
      search: searchParams.get('search') ?? undefined,
      tag: searchParams.get('tag') ?? undefined,
      // XC-01: malformed numerics now 400 (BUG-28); out-of-range still clamps.
      spendMin: parseQueryNumber(searchParams, 'spendMin', { min: 0 }),
      spendMax: parseQueryNumber(searchParams, 'spendMax', { min: 0 }),
      repeatBuyers: parseQueryBool(searchParams, 'repeatBuyers'),
      page: parseQueryInt(searchParams, 'page', { min: 1, max: 1_000_000 }),
      limit: parseQueryInt(searchParams, 'limit', { min: 1, max: 200 }),
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    // INF-02: one-line error mapping — Prisma P2002/P2025 and service
    // sentinels become typed envelope responses; unknown errors are logged
    // server-side and returned as a generic 500 with no internals.
    return toErrorResponse(error, 'GET /api/store/customers');
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

    if (!hasPermission(session.user, PERMISSIONS.CUSTOMER.createCustomer)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = CreateCustomerSchema.safeParse(body);

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

    const customer = await createCustomer(tenantId, parsed.data as CreateCustomerInput);

    return NextResponse.json({ success: true, data: customer }, { status: 201 });
  } catch (error) {
    // INF-02: one-line error mapping — Prisma P2002/P2025 and service
    // sentinels become typed envelope responses; unknown errors are logged
    // server-side and returned as a generic 500 with no internals.
    return toErrorResponse(error, 'POST /api/store/customers');
  }
}
