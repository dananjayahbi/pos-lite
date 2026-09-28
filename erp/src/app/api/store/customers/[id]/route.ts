import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import {
  getCustomerById,
  updateCustomer,
  softDeleteCustomer,
} from '@/lib/services/customer.service';
import { UpdateCustomerSchema } from '@/lib/validators/customer.validators';
import type { UpdateCustomerInput } from '@/lib/validators/customer.validators';
import { toErrorResponse } from '@/lib/api/error-envelope';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

    const { id } = await params;
    const customer = await getCustomerById(tenantId, id);

    return NextResponse.json({ success: true, data: customer });
  } catch (error) {
    // INF-02: one-line error mapping — Prisma P2002/P2025 and service
    // sentinels become typed envelope responses; unknown errors are logged
    // server-side and returned as a generic 500 with no internals.
    return toErrorResponse(error, 'GET /api/store/customers/[id]');
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

    if (!hasPermission(session.user, PERMISSIONS.CUSTOMER.editCustomer)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = UpdateCustomerSchema.safeParse(body);

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

    const { id } = await params;
    const updated = await updateCustomer(tenantId, id, parsed.data as UpdateCustomerInput);

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    // INF-02: one-line error mapping — Prisma P2002/P2025 and service
    // sentinels become typed envelope responses; unknown errors are logged
    // server-side and returned as a generic 500 with no internals.
    return toErrorResponse(error, 'PATCH /api/store/customers/[id]');
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
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

    if (!hasPermission(session.user, PERMISSIONS.CUSTOMER.deleteCustomer)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { id } = await params;
    const deleted = await softDeleteCustomer(tenantId, id);

    return NextResponse.json({ success: true, data: deleted });
  } catch (error) {
    // INF-02: one-line error mapping — Prisma P2002/P2025 and service
    // sentinels become typed envelope responses; unknown errors are logged
    // server-side and returned as a generic 500 with no internals.
    return toErrorResponse(error, 'DELETE /api/store/customers/[id]');
  }
}
