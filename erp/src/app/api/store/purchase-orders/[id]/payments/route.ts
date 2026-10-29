import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { toErrorResponse } from '@/lib/api/error-envelope';
import { PayPurchaseOrderSchema } from '@/lib/validators/purchaseOrder.validators';
import {
  listPurchaseOrderPayments,
  payPurchaseOrder,
} from '@/lib/services/purchaseOrderPayment.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
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
    const result = await listPurchaseOrderPayments(session.user.tenantId, id);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return toErrorResponse(error, 'GET /api/store/purchase-orders/[id]/payments');
  }
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    if (!hasPermission(session.user, PERMISSIONS.PAYMENT_ACCOUNT.settlePurchaseOrder)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = PayPurchaseOrderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'Validation failed', details: parsed.error.flatten() },
        },
        { status: 400 },
      );
    }

    const result = await payPurchaseOrder(
      session.user.tenantId,
      session.user.id,
      session.user.role,
      id,
      parsed.data,
    );

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error, 'POST /api/store/purchase-orders/[id]/payments');
  }
}
