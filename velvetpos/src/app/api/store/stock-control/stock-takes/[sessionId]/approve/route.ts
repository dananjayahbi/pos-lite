import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { StockTakeStatus, StockMovementReason, UserRole, NotificationType } from '@/generated/prisma/client';
import { createAuditLog } from '@/lib/services/audit.service';

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

    if (!hasPermission(session.user, PERMISSIONS.STOCK.approveStockTake)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const { sessionId } = await props.params;

    const stockTakeSession = await prisma.stockTakeSession.findFirst({
      where: { id: sessionId, tenantId },
      include: {
        items: {
          include: {
            variant: true,
          },
        },
      },
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

    const itemsWithDiscrepancy = stockTakeSession.items.filter(
      (item) => item.discrepancy !== null && item.discrepancy !== 0,
    );

    const result = await prisma.$transaction(async (tx) => {
      for (const item of itemsWithDiscrepancy) {
        const quantityBefore = item.variant.stockQuantity;
        const quantityAfter = quantityBefore + (item.discrepancy ?? 0);

        await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stockQuantity: quantityAfter },
        });

        await tx.stockMovement.create({
          data: {
            tenantId,
            variantId: item.variantId,
            reason: StockMovementReason.STOCK_TAKE_ADJUSTMENT,
            quantityDelta: item.discrepancy ?? 0,
            quantityBefore,
            quantityAfter,
            actorId: session.user.id,
            stockTakeSessionId: sessionId,
            note: `Stock take adjustment for session ${sessionId}`,
          },
        });
      }

      await tx.stockTakeSession.update({
        where: { id: sessionId },
        data: {
          status: StockTakeStatus.APPROVED,
          approvedById: session.user.id,
          approvedAt: new Date(),
        },
      });

      // Notify the session initiator
      await tx.notificationRecord.create({
        data: {
          tenantId,
          recipientId: stockTakeSession.initiatedById,
          type: NotificationType.STOCK_TAKE_APPROVED,
          title: 'Stock take session approved',
          body: `Your stock take session has been approved. ${itemsWithDiscrepancy.length} stock corrections were applied.`,
          relatedEntityType: 'StockTakeSession',
          relatedEntityId: sessionId,
        },
      });

      // Check for low stock after corrections
      const lowStockVariants = itemsWithDiscrepancy.filter((item) => {
        const newQty = item.variant.stockQuantity + (item.discrepancy ?? 0);
        return (
          item.variant.lowStockThreshold > 0 &&
          newQty >= 0 &&
          newQty <= item.variant.lowStockThreshold
        );
      });

      if (lowStockVariants.length > 0) {
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
          const lowStockNotifications = lowStockVariants.flatMap((item) => {
            const newQty = item.variant.stockQuantity + (item.discrepancy ?? 0);
            return recipients.map((r) => ({
              tenantId,
              recipientId: r.id,
              type: NotificationType.LOW_STOCK_ALERT,
              title: `${item.variant.sku} is low on stock`,
              body: `Current stock: ${newQty} units. Threshold: ${item.variant.lowStockThreshold} units. Adjusted by stock take approval.`,
              relatedEntityType: 'ProductVariant',
              relatedEntityId: item.variantId,
            }));
          });

          await tx.notificationRecord.createMany({
            data: lowStockNotifications,
          });
        }
      }

      return { correctionsApplied: itemsWithDiscrepancy.length };
    });

    await createAuditLog({
      tenantId,
      actorId: session.user.id,
      actorRole: session.user.role,
      entityType: 'StockTakeSession',
      entityId: sessionId,
      action: 'STOCK_TAKE_APPROVED',
      after: {
        approvedBy: session.user.id,
        correctionsApplied: result.correctionsApplied,
        approvedAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({ success: true, data: result });
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to approve stock take session' } },
      { status: 500 },
    );
  }
}
