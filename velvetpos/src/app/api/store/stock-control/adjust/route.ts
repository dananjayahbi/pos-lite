import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { StockAdjustmentSchema } from '@/lib/validators/product.validators';

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

    const result = await prisma.$transaction(async (tx) => {
      const variant = await tx.productVariant.findFirst({
        where: { id: variantId, tenantId, deletedAt: null },
        include: { product: { select: { name: true } } },
      });

      if (!variant) {
        throw new Error('NOT_FOUND');
      }

      const newQty = variant.stockQuantity + quantityDelta;
      if (newQty < 0) {
        throw new Error('BELOW_ZERO');
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
          const title = `${productName} — ${sku} is low on stock`;
          const body = `Current stock: ${newQty} units. Threshold: ${variant.lowStockThreshold} units. Adjusted by: ${session.user.name ?? 'Staff'}.`;

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
      };
    });

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
    }

    console.error('Stock adjustment error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process stock adjustment' } },
      { status: 500 },
    );
  }
}
