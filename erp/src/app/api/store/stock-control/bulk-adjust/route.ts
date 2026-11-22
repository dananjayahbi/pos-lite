import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { StockMovementReason } from '@/generated/prisma/client';
import {
  MAX_STOCK_ADJUSTMENT_DELTA,
  MAX_STOCK_QUANTITY,
} from '@/lib/validators/product.validators';
import {
  isManualAdjustmentReason,
  manualAdjustmentDirectionError,
  manualAdjustmentSideEffectSummaries,
} from '@/lib/services/manualAdjustment.core';
import { recordManualAdjustmentSideEffects } from '@/lib/services/inventory.service';
import { lockForUpdate } from '@/lib/api/race-guard';
import { isLowStockVariant } from '@/lib/inventory/lowStockPredicate';
import {
  createLowStockAlerts,
  selectLowStockAlerts,
  type LowStockAlertCandidate,
} from '@/lib/notifications/low-stock-alert';
import { staffDisplayName } from '@/lib/utils/staff-name';
import { revalidateTenantStorefront } from '@/lib/revalidate-website';
import { stockAdjustmentRevalidationOptions } from '@/lib/website/storefront-revalidation.core';

const BulkAdjustSchema = z.object({
  adjustments: z
    .array(
      z.object({
        variantId: z.string().min(1, { error: 'Variant ID is required' }),
        quantityDelta: z
          .number()
          .int()
          .refine((v) => v !== 0, { message: 'quantityDelta cannot be zero' })
          // M09-02 (BUG-41): same business ceiling as StockAdjustmentSchema.
          .refine((v) => Math.abs(v) <= MAX_STOCK_ADJUSTMENT_DELTA, {
            message: `quantityDelta must be between -${MAX_STOCK_ADJUSTMENT_DELTA} and ${MAX_STOCK_ADJUSTMENT_DELTA}`,
          }),
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

    // ARGUS #181: bulk adjustments are manual too — reject system-only reasons
    // at the same boundary as the single-adjust route.
    const invalidReasonIndex = adjustments.findIndex(
      (adj) => !isManualAdjustmentReason(adj.reason),
    );
    if (invalidReasonIndex !== -1) {
      const invalidReason = adjustments[invalidReasonIndex]!.reason;
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_ADJUSTMENT_REASON',
            message: `${invalidReason} is a system-managed stock reason and cannot be used for a manual adjustment.`,
            details: [
              {
                path: `adjustments.${invalidReasonIndex}.reason`,
                message: 'Reason is not a manual adjustment reason',
              },
            ],
          },
        },
        { status: 422 },
      );
    }

    // ARGUS #193: each row's reason must agree with the sign of its delta.
    const invalidDirectionIndex = adjustments.findIndex(
      (adj) => manualAdjustmentDirectionError(adj.reason, adj.quantityDelta) !== null,
    );
    if (invalidDirectionIndex !== -1) {
      const invalid = adjustments[invalidDirectionIndex]!;
      const directionError = manualAdjustmentDirectionError(
        invalid.reason,
        invalid.quantityDelta,
      );
      return NextResponse.json(
        {
          success: false,
          error: {
            code: 'INVALID_ADJUSTMENT_DIRECTION',
            message: directionError,
            details: [
              {
                path: `adjustments.${invalidDirectionIndex}.reason`,
                message: directionError,
              },
            ],
          },
        },
        { status: 422 },
      );
    }

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
      // ARGUS #192: lock all affected variants before reading their quantities
      // (sorted ids keep a stable lock order so overlapping batches cannot
      // deadlock). The fresh read below then sees committed values only, and
      // each movement row records the true before/after.
      for (const id of [...variantIds].sort()) {
        await lockForUpdate(tx, 'product_variants', '"id" = $1 AND "tenantId" = $2', [
          id,
          tenantId,
        ]);
      }

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
      const affectedProductIds = new Set<string>();
      const lowStockCandidates: LowStockAlertCandidate[] = [];

      // Fetch fresh variant state inside transaction
      const freshVariants = await tx.productVariant.findMany({
        where: { id: { in: variantIds }, tenantId, deletedAt: null },
        include: { product: { select: { id: true, name: true } } },
      });
      const variantMap = new Map(freshVariants.map((v) => [v.id, v]));

      for (const adj of adjustments) {
        const variant = variantMap.get(adj.variantId);
        if (!variant) throw new Error('NOT_FOUND');

        affectedProductIds.add(variant.product.id);

        const newQty = variant.stockQuantity + adj.quantityDelta;
        if (newQty < 0) {
          throw new Error(
            `BELOW_ZERO:${variant.sku}:${variant.stockQuantity}`,
          );
        }
        // M09-02 (BUG-41): per-row ceiling check mirrors the below-zero guard
        // so an overflowing batch rolls back with a typed error instead of a
        // Postgres integer-out-of-range 500.
        if (newQty > MAX_STOCK_QUANTITY) {
          throw new Error(
            `ABOVE_MAX:${variant.sku}:${variant.stockQuantity}`,
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

        // Check low stock threshold with the shared rule (ARGUS #55/#215).
        // ARGUS #217: record the quantity before this row so an upward
        // adjustment that lands on the threshold does not alert.
        if (
          isLowStockVariant({
            stockQuantity: newQty,
            lowStockThreshold: variant.lowStockThreshold,
          })
        ) {
          lowStockCandidates.push({
            variantId: adj.variantId,
            productName: variant.product.name,
            sku: variant.sku,
            stockQuantity: newQty,
            lowStockThreshold: variant.lowStockThreshold,
            previousQuantity: variant.stockQuantity,
          });
        }

        // Update the in-memory map for subsequent adjustments to the same variant
        variant.stockQuantity = newQty;
      }

      // One shared producer writes the owner/manager alerts. ARGUS #217: the
      // response's "triggered" list mirrors the alerts that will actually be
      // written (crossings only, deduplicated by the producer).
      const alertedCandidates = selectLowStockAlerts(lowStockCandidates);
      lowStockTriggeredVariantIds.push(
        ...alertedCandidates.map((candidate) => candidate.variantId),
      );

      await createLowStockAlerts(
        tx,
        tenantId,
        lowStockCandidates,
        `Adjusted by: ${staffDisplayName(session.user.email)}`,
      );

      return {
        adjustedCount: movements.length,
        movements,
        lowStockTriggeredVariantIds,
        affectedProductIds: [...affectedProductIds],
      };
    });

    // ARGUS #181 / #186: one audit entry + webhook per applied manual row,
    // matching the single-adjust path. The shared summary helper normalizes the
    // payload and skips system-owned reasons; awaiting each side effect makes
    // sure the writes happen before the response instead of being frozen with
    // the serverless invocation.
    await Promise.all(
      manualAdjustmentSideEffectSummaries(adjustments).map((summary) =>
        recordManualAdjustmentSideEffects({
          tenantId,
          variantId: summary.variantId,
          actorId: session.user.id,
          options: {
            quantityDelta: summary.quantityDelta,
            reason: summary.reason,
            ...(summary.note !== null ? { note: summary.note } : {}),
          },
        }),
      ),
    );

    // ARGUS #195: purge each adjusted product detail page plus the catalog
    // availability filters. Revalidation failure is logged, never fatal.
    try {
      await revalidateTenantStorefront(
        tenantId,
        stockAdjustmentRevalidationOptions(result.affectedProductIds),
      );
    } catch (revalidateError) {
      console.warn(
        '[POST /api/store/stock-control/bulk-adjust] Revalidation warning:',
        revalidateError,
      );
    }

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
      if (error.message.startsWith('ABOVE_MAX:')) {
        const [, sku, currentStock] = error.message.split(':');
        return NextResponse.json(
          {
            success: false,
            error: {
              code: 'ABOVE_MAX_STOCK',
              message: `Adjustment would exceed the maximum stock quantity. SKU: ${sku}, Current stock: ${currentStock}.`,
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
