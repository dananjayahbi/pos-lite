import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import {
  StockAdjustmentSchema,
  MAX_STOCK_QUANTITY,
} from '@/lib/validators/product.validators';
import {
  isManualAdjustmentReason,
  manualAdjustmentDirectionError,
} from '@/lib/services/manualAdjustment.core';
import { recordManualAdjustmentSideEffects } from '@/lib/services/inventory.service';
import { lockForUpdate } from '@/lib/api/race-guard';
import { staffDisplayName } from '@/lib/utils/staff-name';
import { revalidateTenantStorefront } from '@/lib/revalidate-website';
import { stockAdjustmentRevalidationOptions } from '@/lib/website/storefront-revalidation.core';

export async function POST(request: NextRequest) {
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

    if (!hasPermission(session.user, PERMISSIONS.STOCK.adjustStock)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const body: unknown = await request.json();
    const parsed = StockAdjustmentSchema.safeParse(body);

    if (!parsed.success) {
      const errors = parsed.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid input', details: errors } },
        { status: 400 },
      );
    }

    const { variantId, quantityDelta, reason, note } = parsed.data;

    // ARGUS #181: the movement enum is wider than the manual-adjustment
    // allowlist. System-only reasons (SALE, PURCHASE_RECEIVED, INITIAL_STOCK,
    // STOCK_TAKE_ADJUSTMENT, …) must go through the flow that owns them.
    if (!isManualAdjustmentReason(reason)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_ADJUSTMENT_REASON',
            message: `${reason} is a system-managed stock reason and cannot be used for a manual adjustment. Choose Found, Damaged, Stolen, Data Error or Returned to Supplier.`,
            details: [{ path: 'reason', message: 'Reason is not a manual adjustment reason' }],
          },
        },
        { status: 422 },
      );
    }

    // ARGUS #193: direction is part of the reason's meaning.
    const directionError = manualAdjustmentDirectionError(reason, quantityDelta);
    if (directionError) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_ADJUSTMENT_DIRECTION',
            message: directionError,
            details: [{ path: 'reason', message: directionError }],
          },
        },
        { status: 422 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      // ARGUS #192: lock the variant before reading its stock. The route keeps
      // its own low-stock notification transaction instead of delegating to
      // adjustStock, so it must take the same row lock itself; otherwise two
      // concurrent removals both pass the below-zero check.
      await lockForUpdate(tx, 'product_variants', '"id" = $1 AND "tenantId" = $2', [
        variantId,
        tenantId,
      ]);

      const variant = await tx.productVariant.findFirst({
        where: { id: variantId, tenantId, deletedAt: null },
        include: { product: { select: { id: true, name: true } } },
      });

      if (!variant) {
        throw new Error('NOT_FOUND');
      }

      const newQty = variant.stockQuantity + quantityDelta;
      if (newQty < 0) {
        throw new Error('BELOW_ZERO');
      }
      // M09-02 (BUG-41): the schema caps the raw delta, but keep the stored
      // total bounded here too (defense in depth) so the int4 increment can
      // never reach Postgres and fail as an unhandled 500.
      if (newQty > MAX_STOCK_QUANTITY) {
        throw new Error('ABOVE_MAX');
      }

      await tx.productVariant.update({
        where: { id: variantId },
        data: { stockQuantity: { increment: quantityDelta } },
      });

      const movement = await tx.stockMovement.create({
        data: {
          tenantId,
          variantId,
          reason,
          quantityDelta,
          quantityBefore: variant.stockQuantity,
          quantityAfter: newQty,
          actorId: session.user.id,
          note: note ?? null,
        },
      });

      // Low stock notification logic
      let lowStockTriggered = false;
      let productName = '';
      let sku = '';

      if (
        variant.lowStockThreshold > 0 &&
        (newQty === 0 || (newQty > 0 && newQty <= variant.lowStockThreshold))
      ) {
        lowStockTriggered = true;
        productName = variant.product.name;
        sku = variant.sku ?? variant.id;

        const recipients = await tx.user.findMany({
          where: {
            tenantId,
            role: { in: ['OWNER', 'MANAGER'] },
            isActive: true,
            deletedAt: null,
          },
          select: { id: true },
        });

        if (recipients.length > 0) {
          const title = `${productName} - ${sku} is low on stock`;
          const body = `Current stock: ${newQty} units. Threshold: ${variant.lowStockThreshold} units. Adjusted by: ${staffDisplayName(session.user.email)}.`;

          await tx.notificationRecord.createMany({
            data: recipients.map((r) => ({
              tenantId,
              recipientId: r.id,
              type: 'LOW_STOCK_ALERT' as const,
              title,
              body,
              relatedEntityType: 'ProductVariant',
              relatedEntityId: variantId,
            })),
          });
        }
      }

      return {
        quantityBefore: variant.stockQuantity,
        quantityAfter: newQty,
        movement,
        lowStockTriggered,
        productName,
        sku,
        productId: variant.product.id,
      };
    });

    // ARGUS #181 / #186: the route owns the low-stock notification transaction,
    // so it must also record the audit entry and emit the webhook the service
    // path would have written. Await it so the writes complete before the
    // response (fire-and-forget can be frozen in serverless).
    await recordManualAdjustmentSideEffects({
      tenantId,
      variantId,
      actorId: session.user.id,
      options: { quantityDelta, reason, note },
    });

    // ARGUS #195: storefront availability is cached. Purge the adjusted
    // product and catalog filters after the commit; a down website must not
    // fail a successful adjustment.
    try {
      await revalidateTenantStorefront(
        tenantId,
        stockAdjustmentRevalidationOptions([result.productId]),
      );
    } catch (revalidateError) {
      console.warn('[POST /api/store/stock-control/adjust] Revalidation warning:', revalidateError);
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'NOT_FOUND') {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: 'Variant not found' } },
          { status: 404 },
        );
      }
      if (error.message === 'BELOW_ZERO') {
        return NextResponse.json(
          { success: false, error: { code: 'VALIDATION_ERROR', message: 'Stock cannot go below zero' } },
          { status: 400 },
        );
      }
      if (error.message === 'ABOVE_MAX') {
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Adjustment would exceed the maximum stock quantity',
            },
          },
          { status: 400 },
        );
      }
    }

    console.error('Stock adjustment error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process stock adjustment' } },
      { status: 500 },
    );
  }
}
