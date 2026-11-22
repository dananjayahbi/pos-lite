import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { StockTakeStatus, UserRole, NotificationType } from '@/generated/prisma/client';
import { approveStockTake } from '@/lib/services/inventory.service';
import { canApproveStockTake, stockTakeHasNoItems } from '@/lib/services/stockTakePolicy.core';
import { revalidateTenantStorefront } from '@/lib/revalidate-website';
import { stockAdjustmentRevalidationOptions } from '@/lib/website/storefront-revalidation.core';

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
            variant: {
              select: {
                sku: true,
                lowStockThreshold: true,
                // ARGUS #210: storefront product tags/paths for revalidation.
                product: { select: { id: true } },
              },
            },
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

    // ARGUS #212: an empty legacy session cannot be approved as a valid count.
    if (stockTakeHasNoItems(stockTakeSession.items.length)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'EMPTY_SESSION',
            message:
              'This session has no items, so there is nothing to approve. Cancel it and start a session with a scope that has countable variants.',
          },
        },
        { status: 400 },
      );
    }

    // M13-02 (BUG-43) - maker-checker separation: the initiator can never
    // approve their own stock take, even when they hold the approve
    // permission (e.g. OWNER). The shared policy helper is the same rule the
    // service repeats.
    if (
      !canApproveStockTake({
        status: stockTakeSession.status,
        userId: session.user.id,
        initiatedById: stockTakeSession.initiatedById,
        canConduct: true,
        canApprove: true,
      })
    ) {
      return NextResponse.json(
        {
          success: false,
          error: { code: 'FORBIDDEN', message: 'You cannot approve a stock take you initiated' },
        },
        { status: 403 },
      );
    }

    // The service owns the correction: it reads the CURRENT stock under a row
    // lock, compares it with the counted quantity (never the session-start
    // snapshot), applies the delta, records the ledger rows and the approval
    // audit, and rewrites the stored discrepancies (ARGUS #138/#207).
    // ARGUS #187: keep the service's (sessionId, tenantId, actorId) order.
    const result = await approveStockTake(sessionId, tenantId, session.user.id);

    // Notify the session initiator and any low-stock recipients. The stock
    // correction is already committed; these are secondary.
    const itemByVariant = new Map(stockTakeSession.items.map((item) => [item.variantId, item]));
    const countedItems = result.adjustments.filter((adjustment) => adjustment.quantityDelta !== 0);

    try {
      await prisma.notificationRecord.create({
        data: {
          tenantId,
          recipientId: stockTakeSession.initiatedById,
          type: NotificationType.STOCK_TAKE_APPROVED,
          title: 'Stock take session approved',
          body: `Your stock take session has been approved. ${result.adjustmentCount} stock corrections were applied.`,
          relatedEntityType: 'StockTakeSession',
          relatedEntityId: sessionId,
        },
      });

      const lowStockAdjustments = countedItems.filter((adjustment) => {
        const item = itemByVariant.get(adjustment.variantId);
        if (!item || item.variant.lowStockThreshold <= 0) return false;
        return adjustment.countedQuantity >= 0 && adjustment.countedQuantity <= item.variant.lowStockThreshold;
      });

      if (lowStockAdjustments.length > 0) {
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
            data: lowStockAdjustments.flatMap((adjustment) => {
              const item = itemByVariant.get(adjustment.variantId);
              return recipients.map((recipient) => ({
                tenantId,
                recipientId: recipient.id,
                type: NotificationType.LOW_STOCK_ALERT,
                title: `${item?.variant.sku ?? 'Variant'} is low on stock`,
                body: `Current stock: ${adjustment.countedQuantity} units. Threshold: ${item?.variant.lowStockThreshold ?? 0} units. Adjusted by stock take approval.`,
                relatedEntityType: 'ProductVariant',
                relatedEntityId: adjustment.variantId,
              }));
            }),
          });
        }
      }
    } catch (notificationError) {
      console.warn('[POST stock-take approve] notification warning:', notificationError);
    }

    // ARGUS #210: approval changes stock, so purge the affected product pages
    // and catalog availability. Failure is logged, never fatal.
    try {
      const productIds = countedItems
        .map((adjustment) => itemByVariant.get(adjustment.variantId)?.variant.product.id)
        .filter((id): id is string => Boolean(id));
      await revalidateTenantStorefront(
        tenantId,
        stockAdjustmentRevalidationOptions(productIds),
      );
    } catch (revalidateError) {
      console.warn('[POST stock-take approve] Revalidation warning:', revalidateError);
    }

    return NextResponse.json({
      success: true,
      data: { correctionsApplied: result.adjustmentCount },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to approve stock take session';

    // ARGUS #187 (BUG-42): a stored negative/fractional count is invalid input,
    // not a server failure. Return the same 400 the PATCH validator uses.
    if (message.startsWith('Invalid counted quantity')) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_COUNTED_QUANTITY', message } },
        { status: 400 },
      );
    }

    // ARGUS #187 (BUG-43): the route pre-checks this, but a direct service
    // caller (or a race) still gets a typed refusal rather than a 500.
    if (message.includes('cannot approve a stock take you initiated')) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message } },
        { status: 403 },
      );
    }

    // A stale session or a variant that disappeared is a conflict, not a 500;
    // a correction can never produce negative stock because approval now sets
    // the counted quantity directly (ARGUS #207).
    if (
      message.startsWith('Cannot approve') ||
      message.includes('not pending approval') ||
      message.includes('Insufficient stock')
    ) {
      return NextResponse.json(
        { success: false, error: { code: 'CONFLICT', message } },
        { status: 409 },
      );
    }

    console.error('[POST stock-take approve] error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to approve stock take session' } },
      { status: 500 },
    );
  }
}
