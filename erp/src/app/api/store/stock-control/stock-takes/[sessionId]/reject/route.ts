import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { StockTakeStatus, NotificationType } from '@/generated/prisma/client';
import { createAuditLog } from '@/lib/services/audit.service';

export async function POST(
  request: Request,
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

    if (!hasPermission(session.user, PERMISSIONS.STOCK.approveStockTake)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const body = (await request.json()) as { reason?: unknown };
    const reason = typeof body.reason === 'string' ? body.reason.trim() : '';

    if (reason.length < 20) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Rejection reason must be at least 20 characters' } },
        { status: 400 },
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

    if (stockTakeSession.status !== StockTakeStatus.PENDING_APPROVAL) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Session is not pending approval' } },
        { status: 400 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.stockTakeSession.update({
        where: { id: sessionId },
        data: {
          status: StockTakeStatus.REJECTED,
          approvedById: session.user.id,
          notes: reason,
        },
      });

      await tx.notificationRecord.create({
        data: {
          tenantId,
          recipientId: stockTakeSession.initiatedById,
          type: NotificationType.STOCK_TAKE_REJECTED,
          title: 'Stock take session rejected',
          body: `Your stock take session has been rejected. Reason: ${reason}`,
          relatedEntityType: 'StockTakeSession',
          relatedEntityId: sessionId,
        },
      });
    });

    await createAuditLog({
      tenantId,
      actorId: session.user.id,
      actorRole: session.user.role,
      entityType: 'StockTakeSession',
      entityId: sessionId,
      action: 'STOCK_TAKE_REJECTED',
      after: {
        rejectedBy: session.user.id,
        reason,
      },
    });

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to reject stock take session' } },
      { status: 500 },
    );
  }
}
