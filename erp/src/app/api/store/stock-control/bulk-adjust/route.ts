import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { StockMovementReason } from '@/generated/prisma/client';

const BulkAdjustSchema = z.object({
  adjustments: z
    .array(
      z.object({
        variantId: z.string().min(1, { error: 'Variant ID is required' }),
        quantityDelta: z.number().int().refine((v) => v !== 0, { message: 'quantityDelta cannot be zero' }),
        reason: z.nativeEnum(StockMovementReason, { error: 'Invalid reason' }),
        note: z.string().max(500).optional(),
      }),
    )
    .min(1, { error: 'At least one adjustment is required' })
    .max(50, { error: 'Maximum 50 adjustments per batch' }),
});

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
    const parsed = BulkAdjustSchema.safeParse(body);

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

    const { adjustments } = parsed.data;
    const variantIds = [...new Set(adjustments.map((a) => a.variantId))];

    // Validate all variants belong to this tenant
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: variantIds }, tenantId, deletedAt: null },
      select: { id: true },
    });

    const foundIds = new Set(variants.map((v) => v.id));
    const invalidIds = variantIds.filter((id) => !foundIds.has(id));

    if (invalidIds.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: `Invalid variant IDs: ${invalidIds.join(', ')}`,
          },
        },
        { status: 400 },
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const movements: Array<{
        id: string;
        variantId: string;
        quantityBefore: number;
        quantityAfter: number;
        quantityDelta: number;
        reason: StockMovementReason;
        createdAt: Date;
      }> = [];
      const lowStockTriggeredVariantIds: string[] = [];
      const notificationsToCreate: Array<{
        tenantId: string;
        recipientId: string;
        type: 'LOW_STOCK_ALERT';
        title: string;
        body: string;
        relatedEntityType: string;
        relatedEntityId: string;
      }> = [];

      // Fetch fresh variant state inside transaction
      const freshVariants = await tx.productVariant.findMany({
        where: { id: { in: variantIds }, tenantId, deletedAt: null },
        include: { product: { select: { name: true } } },
      });
      const variantMap = new Map(freshVariants.map((v) => [v.id, v]));

      for (const adj of adjustments) {
        const variant = variantMap.get(adj.variantId);
        if (!variant) throw new Error('NOT_FOUND');

        const newQty = variant.stockQuantity + adj.quantityDelta;
        if (newQty < 0) {
          throw new Error(
            `BELOW_ZERO:${variant.sku}:${variant.stockQuantity}`,
          );
        }

        await tx.productVariant.update({
          where: { id: adj.variantId },
          data: { stockQuantity: { increment: adj.quantityDelta } },
        });

        const movement = await tx.stockMovement.create({
          data: {
            tenantId,
            variantId: adj.variantId,
            reason: adj.reason,
            quantityDelta: adj.quantityDelta,
            quantityBefore: variant.stockQuantity,
            quantityAfter: newQty,
            actorId: session.user.id,
            note: adj.note ?? null,
          },
        });

        movements.push({
          id: movement.id,
          variantId: adj.variantId,
          quantityBefore: variant.stockQuantity,
          quantityAfter: newQty,
          quantityDelta: adj.quantityDelta,
          reason: adj.reason,
          createdAt: movement.createdAt,
        });

        // Check low stock threshold
        if (
          variant.lowStockThreshold > 0 &&
          (newQty === 0 || (newQty > 0 && newQty <= variant.lowStockThreshold))
        ) {
          lowStockTriggeredVariantIds.push(adj.variantId);

          const productName = variant.product.name;
          const sku = variant.sku;
          const title = `${productName} — ${sku} is low on stock`;
          const notifBody = `Current stock: ${newQty} units. Threshold: ${variant.lowStockThreshold} units. Adjusted by: ${session.user.name ?? 'Staff'}.`;

          notificationsToCreate.push({
            tenantId,
            recipientId: '',
            type: 'LOW_STOCK_ALERT' as const,
            title,
            body: notifBody,
            relatedEntityType: 'ProductVariant',
            relatedEntityId: adj.variantId,
          });
        }

        // Update the in-memory map for subsequent adjustments to the same variant
        variant.stockQuantity = newQty;
      }

      // Create notifications in batch
      if (notificationsToCreate.length > 0) {
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
          const allNotifications = notificationsToCreate.flatMap((n) =>
            recipients.map((r) => ({
              ...n,
              recipientId: r.id,
            })),
          );

          await tx.notificationRecord.createMany({
            data: allNotifications,
          });
        }
      }

      return {
        adjustedCount: movements.length,
        movements,
        lowStockTriggeredVariantIds,
      };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.startsWith('BELOW_ZERO:')) {
        const [, sku, currentStock] = error.message.split(':');
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'BELOW_ZERO_STOCK',
              message: `Adjustment would result in negative stock quantity. SKU: ${sku}, Current stock: ${currentStock}.`,
            },
          },
          { status: 422 },
        );
      }
    }

    console.error('Bulk stock adjustment error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to process bulk adjustment' } },
      { status: 500 },
    );
  }
}
