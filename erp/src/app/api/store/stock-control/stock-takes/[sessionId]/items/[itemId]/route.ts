import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { StockTakeItemUpdateSchema } from '@/lib/validators/stock-take.validators';
import { canEditStockTake } from '@/lib/services/stockTakePolicy.core';

export async function PATCH(
  request: NextRequest,
  props: { params: Promise<{ sessionId: string; itemId: string }> },
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

    const { sessionId, itemId } = await props.params;

    if (!hasPermission(session.user, PERMISSIONS.STOCK.conductStockTake)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    // Verify session belongs to tenant
    const stockTakeSession = await prisma.stockTakeSession.findFirst({
      where: { id: sessionId, tenantId },
      select: { id: true, status: true },
    });

    if (!stockTakeSession) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Stock take session not found' } },
        { status: 404 },
      );
    }

    // Counts are only editable while counting is in progress (ARGUS #205).
    // PENDING_APPROVAL / APPROVED / CANCELLED sessions are immutable.
    if (
      !canEditStockTake({
        status: stockTakeSession.status,
        canConduct: true,
      })
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CONFLICT',
            message: 'Counted quantities can only be changed while the session is in progress',
          },
        },
        { status: 409 },
      );
    }

    // M13-01 (BUG-42) — the count must be a non-negative integer before it can
    // corrupt the stored discrepancy; reject everything else up front.
    const body: unknown = await request.json();
    const parsed = StockTakeItemUpdateSchema.safeParse(body);
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

    // Fetch current item to compute discrepancy
    const currentItem = await prisma.stockTakeItem.findFirst({
      where: { id: itemId, sessionId },
    });

    if (!currentItem) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Stock take item not found' } },
        { status: 404 },
      );
    }

    const updateData: {
      countedQuantity?: number | null;
      discrepancy?: number | null;
      isRecounted?: boolean;
    } = {};

    if (parsed.data.countedQuantity !== undefined) {
      // ARGUS #208: null is the explicit "not counted" state. Clear both the
      // count and its discrepancy so progress and completion see the row as
      // uncounted again, exactly as the input UI now means.
      updateData.countedQuantity = parsed.data.countedQuantity;
      updateData.discrepancy =
        parsed.data.countedQuantity === null
          ? null
          : parsed.data.countedQuantity - currentItem.systemQuantity;
    }

    if (parsed.data.isRecounted !== undefined) {
      updateData.isRecounted = parsed.data.isRecounted;
    }

    const updatedItem = await prisma.stockTakeItem.update({
      where: { id: itemId },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: updatedItem });
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to update stock take item' } },
      { status: 500 },
    );
  }
}
