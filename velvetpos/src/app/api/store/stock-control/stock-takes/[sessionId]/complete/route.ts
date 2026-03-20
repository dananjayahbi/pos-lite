import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { StockTakeStatus, UserRole, NotificationType } from '@/generated/prisma/client';

export async function POST(
  _request: Request,
  props: { params: Promise<{ sessionId: string }> },
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

    const { sessionId } = await props.params;

    const stockTakeSession = await prisma.stockTakeSession.findFirst({
      where: { id: sessionId, tenantId, status: StockTakeStatus.IN_PROGRESS },
    });

    if (!stockTakeSession) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'In-progress stock take session not found' } },
        { status: 404 },
      );
    }

    // Check all items have countedQuantity
    const uncountedItems = await prisma.stockTakeItem.count({
      where: { sessionId, countedQuantity: null },
    });

    if (uncountedItems > 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INCOMPLETE',
            message: `${uncountedItems} item(s) have not been counted yet`,
          },
        },
        { status: 400 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.stockTakeSession.update({
        where: { id: sessionId },
        data: {
          status: StockTakeStatus.PENDING_APPROVAL,
          completedAt: new Date(),
        },
      });

      const recipients = await tx.user.findMany({
        where: {
          tenantId,
          role: { in: [UserRole.OWNER, UserRole.MANAGER] },
          isActive: true,
          deletedAt: null,
        },
        select: { id: true },
      });

      if (recipients.length > 0) {
        await tx.notificationRecord.createMany({
          data: recipients.map((r) => ({
            tenantId,
            recipientId: r.id,
            type: NotificationType.STOCK_TAKE_SUBMITTED,
            title: 'Stock take session submitted for approval',
            body: 'A stock take session has been completed and requires your review.',
            relatedEntityType: 'StockTakeSession',
            relatedEntityId: sessionId,
          })),
        });
      }
    });

    return NextResponse.json({ success: true, data: { sessionId, status: 'PENDING_APPROVAL' } });
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to complete stock take session' } },
      { status: 500 },
    );
  }
}
