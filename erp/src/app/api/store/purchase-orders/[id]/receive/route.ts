import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { receivePOLines } from '@/lib/services/purchaseOrder.service';
import { ReceivePOLinesSchema } from '@/lib/validators/purchaseOrder.validators';
import { envelopeError, toErrorResponse } from '@/lib/api/error-envelope';
import { mapServiceError } from '@/lib/api/map-service-error';

/**
 * POST /api/store/purchase-orders/[id]/receive — post a goods receipt.
 *
 * M16-01 (BUG-48): the catch now delegates typed service sentinels to the
 * INF-02 mapper, so a receipt that loses the row-lock race surfaces as a typed
 * 409 (`OVER_RECEIPT`) instead of a generic 500. The happy-path response
 * contract (`{ success:true, data:{ updatedPO, costPricesChanged,
 * costPriceChangedCount } }` at 200) is unchanged.
 */
export async function POST(
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

    if (!hasPermission(session.user, PERMISSIONS.SUPPLIER.receivePurchaseOrder)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = ReceivePOLinesSchema.safeParse(body);

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

    const result = await receivePOLines(tenantId, id, parsed.data, session.user.id);

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';

    // M16-01 (BUG-48): typed sentinels first — OVER_RECEIPT is a 409, and its
    // prose happens to contain "would exceed", so it must not fall into the
    // legacy 400 branch below. Unregistered messages return null and continue.
    const mapped = mapServiceError(error);
    if (mapped) return envelopeError(mapped);

    if (message === 'Purchase order not found') {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message } },
        { status: 404 },
      );
    }

    if (
      message.startsWith('Cannot receive') ||
      message.includes('not found in this') ||
      message.includes('must be greater') ||
      message.includes('would exceed')
    ) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message } },
        { status: 400 },
      );
    }

    return toErrorResponse(error, 'POST /api/store/purchase-orders/[id]/receive');
  }
}
