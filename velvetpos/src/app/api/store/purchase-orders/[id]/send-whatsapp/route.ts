import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import {
  getPOById,
  updatePOStatus,
  formatPOForWhatsApp,
} from '@/lib/services/purchaseOrder.service';
import { sendWhatsAppTextMessage } from '@/lib/whatsapp';
import { POStatus } from '@/generated/prisma/client';

export async function POST(
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

    if (
      !hasPermission(session.user, PERMISSIONS.SUPPLIER.createPurchaseOrder) &&
      !hasPermission(session.user, PERMISSIONS.SUPPLIER.approvePurchaseOrder)
    ) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { id } = await params;

    let po;
    try {
      po = await getPOById(tenantId, id);
    } catch {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Purchase order not found' } },
        { status: 404 },
      );
    }

    if (po.status !== POStatus.DRAFT) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: `Only DRAFT purchase orders can be sent. Current status: ${po.status}.`,
          },
        },
        { status: 422 },
      );
    }

    if (!po.supplier.whatsappNumber) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'NO_WHATSAPP',
            message: 'Supplier has no WhatsApp number configured.',
          },
        },
        { status: 422 },
      );
    }

    const message = formatPOForWhatsApp(po);
    const whatsappResult = await sendWhatsAppTextMessage(
      po.supplier.whatsappNumber,
      message,
    );

    if (!whatsappResult.success) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'WHATSAPP_FAILED',
            message:
              'WhatsApp send failed. Please try again or contact the supplier manually.',
          },
        },
        { status: 502 },
      );
    }

    const updatedPO = await updatePOStatus(tenantId, id, POStatus.SENT);

    return NextResponse.json({ success: true, data: updatedPO });
  } catch (error) {
    console.error('WhatsApp send error:', error);
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        },
      },
      { status: 500 },
    );
  }
}
