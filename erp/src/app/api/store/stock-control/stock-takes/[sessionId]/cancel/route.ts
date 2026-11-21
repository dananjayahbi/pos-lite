import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { StockTakeStatus } from '@/generated/prisma/client';
import { createAuditLog } from '@/lib/services/audit.service';
import { canCancelStockTake, cancelDisposition } from '@/lib/services/stockTakePolicy.core';
import { z } from 'zod/v4';

const cancelSchema = z.object({
  /** Cancellation is discard-only. `apply` is accepted by the schema so the
   * route can reject it with an explicit reason instead of a generic 400. */
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

    const body = await request.json();
    const parsed = cancelSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'BAD_REQUEST', message: 'Invalid request body' } },
        { status: 400 },
      );
    }
    const { action, note } = parsed.data;

    // ARGUS #206 — cancellation never applies counts. Applying discrepancies
    // must go through complete → approve (stock:take:approve + maker-checker).
    if (cancelDisposition(action) === 'reject') {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'CANCEL_APPLY_NOT_ALLOWED',
            message:
              'Cancelling only discards counted data - submit the session for approval to apply corrections',
          },
        },
        { status: 422 },
      );
    }

    const { sessionId } = await props.params;

    const stockTakeSession = await prisma.stockTakeSession.findFirst({
      where: { id: sessionId, tenantId },
      include: {
        items: {
          select: { countedQuantity: true, discrepancy: true },
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

    const canConduct = hasPermission(session.user, PERMISSIONS.STOCK.conductStockTake);
    const canApprove = hasPermission(session.user, PERMISSIONS.STOCK.approveStockTake);
    if (
      !canCancelStockTake({
        status: stockTakeSession.status,
        userId: session.user.id,
        initiatedById: stockTakeSession.initiatedById,
        canConduct,
        canApprove,
      })
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Only the initiator or a stock-take approver can cancel this session',
          },
        },
        { status: 403 },
      );
    }

    const countedItems = stockTakeSession.items.filter(
      (item) => item.countedQuantity !== null,
    );
    const itemsWithDiscrepancy = countedItems.filter(
      (item) => item.discrepancy !== null && item.discrepancy !== 0,
    );

    // Discard only: stock quantity, movements and counted items stay untouched.
    await prisma.stockTakeSession.update({
      where: { id: sessionId },
      data: {
        status: StockTakeStatus.CANCELLED,
        completedAt: new Date(),
        notes: note ?? 'Cancelled - counted data discarded, stock unchanged',
      },
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
        action: 'discard',
        discardedCountedItems: countedItems.length,
        discardedDiscrepancies: itemsWithDiscrepancy.length,
        stockUnchanged: true,
        cancelledAt: new Date().toISOString(),
      },
    });

    return NextResponse.json({
      success: true,
      data: { action: 'discard', countedItems: countedItems.length },
    });
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
