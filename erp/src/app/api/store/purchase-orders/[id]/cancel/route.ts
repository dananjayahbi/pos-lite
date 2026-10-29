import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { toErrorResponse } from '@/lib/api/error-envelope';
import { cancelPO } from '@/lib/services/purchaseOrder.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.tenantId) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHORIZED', message: 'Authentication required' } },
        { status: 401 },
      );
    }

    if (!hasPermission(session.user, PERMISSIONS.SUPPLIER.cancelPurchaseOrder)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { id } = await params;
    const po = await cancelPO(session.user.tenantId, id);
    return NextResponse.json({ success: true, data: po });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';

    if (message === 'Purchase order not found') {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message } },
        { status: 404 },
      );
    }

    if (message.startsWith('Cannot cancel')) {
      return NextResponse.json(
        { success: false, error: { code: 'CONFLICT', message } },
        { status: 409 },
      );
    }

    return toErrorResponse(error, 'POST /api/store/purchase-orders/[id]/cancel');
  }
}
