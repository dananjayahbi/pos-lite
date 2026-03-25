import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { StockTakeStatus, StockMovementReason } from '@/generated/prisma/client';
import { createAuditLog } from '@/lib/services/audit.service';
import { z } from 'zod/v4';

const cancelSchema = z.object({
  /** 'none'  – session had no counted items, just cancel cleanly              */
  /** 'discard' – ignore all counted items, keep stock as-is                  */
  /** 'apply'   – apply all counted discrepancies as stock adjustments        */
  action: z.enum(['none', 'discard', 'apply']),
  note: z.string().max(500).optional(),
});

export async function POST(
  request: NextRequest,
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

    if (!hasPermission(session.user, PERMISSIONS.STOCK.conductStockTake)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = cancelSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid request body' } },
        { status: 400 },
      );
    }
    const { action, note } = parsed.data;

    const { sessionId } = await props.params;

    const stockTakeSession = await prisma.stockTakeSession.findFirst({
      where: { id: sessionId, tenantId },
      include: {
        items: {
          include: { variant: true },
        },
      },
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
          error: { code: 'BAD_REQUEST', message: 'Only in-progress sessions can be cancelled' },
        },
        { status: 400 },
      );
    }

    const countedItems = stockTakeSession.items.filter(
      (item) => item.countedQuantity !== null,
    );
    const itemsWithDiscrepancy = countedItems.filter(
      (item) => item.discrepancy !== null && item.discrepancy !== 0,
    );

    await prisma.$transaction(async (tx) => {
      // Apply counted discrepancies if user chose to keep partial progress
      if (action === 'apply' && itemsWithDiscrepancy.length > 0) {
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
              note: `Partial stock take adjustment – session cancelled (${sessionId})`,
            },
          });
        }
      }

      await tx.stockTakeSession.update({
        where: { id: sessionId },
        data: {
          status: StockTakeStatus.CANCELLED,
          completedAt: new Date(),
          notes: note
            ? note
            : action === 'apply'
              ? 'Cancelled – partial counted changes applied'
              : 'Cancelled – no changes applied',
        },
      });
    });

    await createAuditLog({
      tenantId,
      actorId: session.user.id,
      actorRole: session.user.role,
      entityType: 'StockTakeSession',
      entityId: sessionId,
      action: 'STOCK_TAKE_CANCELLED',
      after: {
        cancelledBy: session.user.id,
        action,
        appliedCorrections: action === 'apply' ? itemsWithDiscrepancy.length : 0,
        cancelledAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({ success: true, data: { action, countedItems: countedItems.length } });
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Failed to cancel stock take session' },
      },
      { status: 500 },
    );
  }
}
