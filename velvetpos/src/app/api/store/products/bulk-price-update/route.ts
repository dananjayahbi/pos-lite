import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { hasPermission } from '@/lib/utils/permissions';
import { PERMISSIONS } from '@/lib/constants/permissions';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { Prisma } from '@/generated/prisma/client';
import { createAuditLog } from '@/lib/services/audit.service';

const BulkPriceUpdateSchema = z
  .object({
    productIds: z.array(z.string()).min(1).max(500),
    mode: z.enum(['FIXED', 'PERCENT']),
    costPrice: z.number().positive().optional(),
    retailPrice: z.number().positive().optional(),
    percentage: z.number().int().min(1).max(200).optional(),
    direction: z.enum(['INCREASE', 'DECREASE']).optional(),
    target: z.enum(['COST', 'RETAIL', 'BOTH']).optional(),
  })
  .refine(
    (data) => {
      if (data.mode === 'FIXED') return data.costPrice !== undefined && data.retailPrice !== undefined;
      if (data.mode === 'PERCENT')
        return data.percentage !== undefined && data.direction !== undefined && data.target !== undefined;
      return false;
    },
    { message: 'Missing required fields for the selected mode' },
  );

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

    if (!hasPermission(session.user, PERMISSIONS.PRODUCT.editProduct)) {
      return NextResponse.json(
        { success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } },
        { status: 403 },
      );
    }

    const body = await request.json();
    const parsed = BulkPriceUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: parsed.error.issues } },
        { status: 400 },
      );
    }

    const { productIds, mode, costPrice, retailPrice, percentage, direction, target } = parsed.data;

    // Get all variants for the selected products belonging to this tenant
    const variants = await prisma.productVariant.findMany({
      where: {
        productId: { in: productIds },
        tenantId,
        deletedAt: null,
      },
      select: {
        id: true,
        productId: true,
        costPrice: true,
        retailPrice: true,
      },
    });

    let updated = 0;
    let errors = 0;

    await prisma.$transaction(async (tx) => {
      for (const variant of variants) {
        try {
          const updateData: Record<string, unknown> = {};
          const currentCost = Number(variant.costPrice);
          const currentRetail = Number(variant.retailPrice);

          if (mode === 'FIXED') {
            updateData.costPrice = costPrice;
            updateData.retailPrice = retailPrice;
          } else {
            const multiplier = direction === 'INCREASE' ? 1 + percentage! / 100 : 1 - percentage! / 100;
            if (target === 'COST' || target === 'BOTH') {
              updateData.costPrice = Math.round(currentCost * multiplier * 100) / 100;
            }
            if (target === 'RETAIL' || target === 'BOTH') {
              updateData.retailPrice = Math.round(currentRetail * multiplier * 100) / 100;
            }
          }

          await tx.productVariant.update({
            where: { id: variant.id },
            data: updateData,
          });
          updated++;
        } catch {
          errors++;
        }
      }

      // Audit log per product
      const uniqueProductIds = [...new Set(variants.map((v) => v.productId))];
      for (const pid of uniqueProductIds) {
        await createAuditLog({
          tenantId,
          actorId: session.user!.id,
          actorRole: session.user!.role ?? 'SYSTEM',
          entityType: 'Product',
          entityId: pid,
          action: 'BULK_PRICE_UPDATE',
          after: (mode === 'FIXED'
            ? { mode, costPrice, retailPrice }
            : { mode, percentage, direction, target }) as unknown as Prisma.InputJsonValue,
        });
      }
    });

    return NextResponse.json({ success: true, data: { updated, errors } });
  } catch (error) {
    console.error('POST /api/store/products/bulk-price-update error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_SERVER_ERROR', message: 'An unexpected error occurred' } },
      { status: 500 },
    );
  }
}
