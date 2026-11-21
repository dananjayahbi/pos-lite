import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { StockTakeStatus, NotificationType, UserRole } from '@/generated/prisma/client';
import { completeStockTakeSession } from '@/lib/services/inventory.service';

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

    // ARGUS #205 — completing submits counted data for approval; it requires
    // the same stock-take permission as counting.
    if (!hasPermission(session.user, PERMISSIONS.STOCK.conductStockTake)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { sessionId } = await props.params;

    const stockTakeSession = await prisma.stockTakeSession.findFirst({
      where: { id: sessionId, tenantId },
      select: { id: true, status: true, initiatedById: true },
    });

    if (!stockTakeSession) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Stock take session not found' } },
        { status: 404 },
      );
    }

    if (stockTakeSession.status !== StockTakeStatus.IN_PROGRESS) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'CONFLICT', message: 'Only an in-progress stock take can be completed' },
        },
        { status: 409 },
      );
    }

    // Maker-checker: only the cashier who opened the count may submit it. The
    // service repeats this guard; checking here yields a typed 403 instead of
    // a generic 500.
    if (stockTakeSession.initiatedById !== session.user.id) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Only the initiator can complete the stock take session',
          },
        },
        { status: 403 },
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

    // The service owns the status transition AND the STOCK_TAKE_COMPLETED
    // audit row (ARGUS #205); the route must not duplicate either.
    await completeStockTakeSession(sessionId, tenantId, session.user.id);

    const recipients = await prisma.user.findMany({
      where: {
        tenantId,
        role: { in: [UserRole.OWNER, UserRole.MANAGER] },
        isActive: true,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (recipients.length > 0) {
      await prisma.notificationRecord.createMany({
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

    return NextResponse.json({ success: true, data: { sessionId, status: 'PENDING_APPROVAL' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';

    if (message.includes('not found or does not belong')) {
      return NextResponse.json(
        { success: false, error: { code: 'NOT_FOUND', message: 'Stock take session not found' } },
        { status: 404 },
      );
    }
    if (message.includes('Only the initiator')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message } },
        { status: 403 },
      );
    }
    if (message.includes('not in progress') || message.includes('uncounted items remain')) {
      return NextResponse.json(
        { success: false, error: { code: 'CONFLICT', message } },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to complete stock take session' } },
      { status: 500 },
    );
  }
}
