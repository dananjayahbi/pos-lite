import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { getPOById, updatePO, updatePOStatus } from '@/lib/services/purchaseOrder.service';
import { UpdatePOSchema, UpdatePOStatusSchema } from '@/lib/validators/purchaseOrder.validators';

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

    if (!hasPermission(session.user, PERMISSIONS.SUPPLIER.viewSupplier)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { id } = await params;
    const po = await getPOById(tenantId, id);

    return NextResponse.json({ success: true, data: po });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';

    if (message === 'Purchase order not found') {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message } },
        { status: 404 },
      );
    }

    console.error('GET /api/store/purchase-orders/[id] error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
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

    if (!hasPermission(session.user, PERMISSIONS.SUPPLIER.approvePurchaseOrder)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { id } = await params;
    const body = await request.json();

    // A `status`-only body is the long-standing send/cancel transition; any
    // other field set is a draft edit. Keeping them on one PATCH avoids a
    // second endpoint the UI would have to know about.
    if (body && typeof body === 'object' && Object.keys(body).length === 1 && 'status' in body) {
      const parsed = UpdatePOStatusSchema.safeParse(body);

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

      const po = await updatePOStatus(tenantId, id, parsed.data.status);
      return NextResponse.json({ success: true, data: po });
    }

    if (!hasPermission(session.user, PERMISSIONS.SUPPLIER.createPurchaseOrder)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const parsedEdit = UpdatePOSchema.safeParse(body);

    if (!parsedEdit.success) {
      const errors = parsedEdit.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: errors } },
        { status: 400 },
      );
    }

    const edited = await updatePO(tenantId, id, parsedEdit.data);
    return NextResponse.json({ success: true, data: edited });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';

    if (message === 'Purchase order not found') {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message } },
        { status: 404 },
      );
    }

    if (message.startsWith('Cannot transition') || message.startsWith('Cannot edit')) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message } },
        { status: 400 },
      );
    }

    // Status/state guards that make the request valid but impossible right now.
    if (message.startsWith('Lines cannot be edited') || message.startsWith('A cancelled purchase order')) {
      return NextResponse.json(
        { success: false, error: { code: 'CONFLICT', message } },
        { status: 409 },
      );
    }

    if (message.includes('already in use') || message.includes('not found or closed')) {
      return NextResponse.json(
        { success: false, error: { code: 'CONFLICT', message } },
        { status: 409 },
      );
    }

    console.error('PATCH /api/store/purchase-orders/[id] error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
