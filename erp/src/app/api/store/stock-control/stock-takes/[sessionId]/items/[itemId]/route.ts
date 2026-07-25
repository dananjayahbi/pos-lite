import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

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

    // Verify session belongs to tenant
    const stockTakeSession = await prisma.stockTakeSession.findFirst({
      where: { id: sessionId, tenantId },
      select: { id: true },
    });

    if (!stockTakeSession) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Stock take session not found' } },
        { status: 404 },
      );
    }

    const body = (await request.json()) as {
      countedQuantity?: number;
      isRecounted?: boolean;
    };

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
      countedQuantity?: number;
      discrepancy?: number;
      isRecounted?: boolean;
    } = {};

    if (body.countedQuantity !== undefined) {
      updateData.countedQuantity = body.countedQuantity;
      updateData.discrepancy = body.countedQuantity - currentItem.systemQuantity;
    }

    if (body.isRecounted !== undefined) {
      updateData.isRecounted = body.isRecounted;
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
